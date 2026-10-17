import { InfluxDB, Point } from "@influxdata/influxdb-client";
import type { VitalsPacket } from "./types.js";

/**
 * CareConnect InfluxDB Vitals Time-Series Storage
 * Manages high-frequency telemetry storage and historical queries.
 * Includes graceful in-memory buffer fallback when InfluxDB is offline.
 */

const url = process.env.INFLUX_URL || "http://localhost:8086";
const token = process.env.INFLUX_TOKEN || "careconnect-dev-token";
const org = process.env.INFLUX_ORG || "careconnect";
const bucket = process.env.INFLUX_BUCKET || "vitals";

let client: InfluxDB | null = null;
let writeApi: ReturnType<InfluxDB["getWriteApi"]> | null = null;
let queryApi: ReturnType<InfluxDB["getQueryApi"]> | null = null;
let isInfluxAvailable: boolean | null = null;

// In-memory fallback buffer (patient_id -> VitalsPacket[])
const inMemoryVitals = new Map<string, VitalsPacket[]>();

export function getInfluxClient(): InfluxDB {
  if (!client) {
    client = new InfluxDB({ url, token, timeout: 1000 });
    writeApi = client.getWriteApi(org, bucket, "ms", {
      maxRetries: 0,
      retryInterval: 50,
      maxRetryTime: 100,
    });
    queryApi = client.getQueryApi(org);
  }
  return client;
}

/**
 * Records a vitals packet into InfluxDB.
 * Gracefully falls back to in-memory buffer if InfluxDB is unreachable.
 */
export async function writeVitalsToInflux(packet: VitalsPacket): Promise<void> {
  // Always update in-memory cache for ultra-fast latest retrieval and fallback
  const list = inMemoryVitals.get(packet.patient_id) || [];
  list.unshift(packet);
  if (list.length > 500) list.pop();
  inMemoryVitals.set(packet.patient_id, list);

  // In mock mode without explicit InfluxDB, rely on in-memory storage
  if (process.env.MOCK_NOTIFICATIONS === "true" && !process.env.FORCE_INFLUX) {
    return;
  }

  if (isInfluxAvailable === false) {
    return;
  }

  try {
    getInfluxClient();
    if (!writeApi) writeApi = client!.getWriteApi(org, bucket, "ms");

    const date = packet.timestamp ? new Date(packet.timestamp) : new Date();
    const point = new Point("vitals")
      .tag("patient_id", packet.patient_id)
      .floatField("heart_rate", packet.heart_rate)
      .floatField("spo2", packet.spo2)
      .floatField("systolic_bp", packet.systolic_bp)
      .floatField("diastolic_bp", packet.diastolic_bp)
      .timestamp(date);

    writeApi.writePoint(point);
    await writeApi.flush();
    isInfluxAvailable = true;
  } catch (err: unknown) {
    if (isInfluxAvailable !== false) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[InfluxDB] Could not write to InfluxDB (${msg}). Using in-memory vitals cache.`);
    }
    isInfluxAvailable = false;
  }
}

/**
 * Queries vitals history for a patient from InfluxDB.
 */
export async function queryVitalsHistory(
  patient_id: string,
  start = "-1h",
  limit = 100,
): Promise<VitalsPacket[]> {
  if (isInfluxAvailable !== false) {
    try {
      getInfluxClient();
      if (!queryApi) queryApi = client!.getQueryApi(org);

      const fluxQuery = `
        from(bucket: "${bucket}")
          |> range(start: ${start})
          |> filter(fn: (r) => r["_measurement"] == "vitals")
          |> filter(fn: (r) => r["patient_id"] == "${patient_id}")
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: ${limit})
      `;

      const results: VitalsPacket[] = [];
      await new Promise<void>((resolve, reject) => {
        queryApi!.queryRows(fluxQuery, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            results.push({
              patient_id: String(o.patient_id),
              timestamp: o._time,
              heart_rate: Number(o.heart_rate ?? 0),
              spo2: Number(o.spo2 ?? 0),
              systolic_bp: Number(o.systolic_bp ?? 0),
              diastolic_bp: Number(o.diastolic_bp ?? 0),
            });
          },
          error(error) {
            reject(error);
          },
          complete() {
            resolve();
          },
        });
      });

      if (results.length > 0) {
        return results;
      }
    } catch {
      isInfluxAvailable = false;
    }
  }

  // Fallback to in-memory history
  const memList = inMemoryVitals.get(patient_id) || [];
  return memList.slice(0, limit);
}

/**
 * Gets the latest vitals packet for a patient.
 */
export async function getLatestVitals(patient_id: string): Promise<VitalsPacket | null> {
  const history = await queryVitalsHistory(patient_id, "-24h", 1);
  if (history.length > 0) {
    return history[0];
  }
  const mem = inMemoryVitals.get(patient_id);
  return mem && mem.length > 0 ? mem[0] : null;
}

export function clearInMemoryVitals(): void {
  inMemoryVitals.clear();
}
