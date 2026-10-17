import type { VitalsPacket } from "./types.js";

type WriteApi = {
  writePoint: (point: unknown) => void;
  flush: () => Promise<void>;
  close: () => Promise<void>;
};

let writeApi: WriteApi | null = null;
let writeApiInitialized = false;

async function getWriteApi(): Promise<WriteApi | null> {
  if (writeApiInitialized) {
    return writeApi;
  }
  const url = process.env.INFLUX_URL;
  const token = process.env.INFLUX_TOKEN;
  const org = process.env.INFLUX_ORG;
  const bucket = process.env.INFLUX_BUCKET;
  if (!url || !token || !org || !bucket) {
    writeApiInitialized = true;
    writeApi = null;
    return null;
  }
  try {
    // @ts-ignore
    const mod: any = await import("@influxdata/influxdb-client" as any);
    const client = new mod.InfluxDB({ url, token });
    writeApi = client.getWriteApi(org, bucket, "ms");
    writeApiInitialized = true;
    return writeApi;
  } catch (error) {
    console.warn("[influx] client unavailable, storing vitals in memory only", error);
    writeApiInitialized = true;
    writeApi = null;
    return null;
  }
}

export async function writeVitalsToInflux(packet: VitalsPacket): Promise<boolean> {
  const api = await getWriteApi();
  if (!api) {
    return false;
  }
  try {
    // @ts-ignore
    const mod: any = await import("@influxdata/influxdb-client" as any);
    const point = new mod.Point("vitals")
      .tag("patient_id", packet.patient_id)
      .floatField("heart_rate", packet.heart_rate)
      .floatField("spo2", packet.spo2)
      .floatField("systolic_bp", packet.systolic_bp)
      .floatField("diastolic_bp", packet.diastolic_bp)
      .timestamp(new Date(packet.timestamp));
    api.writePoint(point);
    await api.flush();
    return true;
  } catch (error) {
    console.warn("[influx] write failed; continuing with in-memory store", error);
    return false;
  }
}
