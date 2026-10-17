import os
import cv2
import numpy as np


def generate_sample_images():
    output_dir = os.path.join(os.path.dirname(__file__), "../samples")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Printed prescription image
    # Clean, black on white, standard font, horizontal divider
    img_printed = np.full((700, 550, 3), 255, dtype=np.uint8)
    # Header
    cv2.putText(img_printed, "ST. JUDE MEDICAL CLINIC", (80, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.putText(img_printed, "100 Health Blvd, Suite 400", (160, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 80, 80), 1)
    cv2.line(img_printed, (30, 100), (520, 100), (0, 0, 0), 2)

    # Patient info (notice: no real names)
    cv2.putText(img_printed, "ID: pt_printed_01   Date: 2026-10-18   Age: 58", (40, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.line(img_printed, (30, 170), (520, 170), (0, 0, 0), 2)

    # Rx Body
    cv2.putText(img_printed, "Rx:", (40, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)
    cv2.putText(img_printed, "1. Tab Lipitor 20mg OD pc for 30 days", (70, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    cv2.putText(img_printed, "2. Tab Metformin 500mg BD pc for 60 days", (70, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    cv2.putText(img_printed, "3. Tab Lisinopril 10mg OD morning for 90 days", (70, 380), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    cv2.line(img_printed, (30, 520), (520, 520), (0, 0, 0), 2)

    # Footer
    cv2.putText(img_printed, "Dr. Robert Vance, MD   Lic #NY-489201", (60, 570), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.imwrite(os.path.join(output_dir, "printed.png"), img_printed)

    # 2. Neat handwriting style image
    img_neat = np.full((700, 550, 3), 250, dtype=np.uint8)
    cv2.putText(img_neat, "WELLNESS HEALTH CENTER", (100, 50), cv2.FONT_HERSHEY_DUPLEX, 0.65, (30, 30, 30), 2)
    cv2.line(img_neat, (30, 100), (520, 100), (40, 40, 40), 1)

    cv2.putText(img_neat, "ID: pt_neat_02   Date: 2026-10-18   Age: 42", (40, 140), cv2.FONT_HERSHEY_COMPLEX_SMALL, 0.8, (30, 30, 30), 1)
    cv2.line(img_neat, (30, 170), (520, 170), (40, 40, 40), 1)

    cv2.putText(img_neat, "Rx:", (40, 210), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 1.0, (20, 20, 20), 2)
    cv2.putText(img_neat, "Tab Glucophage 500mg 1-0-1 pc x 60d", (70, 270), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 0.75, (20, 20, 20), 2)
    cv2.putText(img_neat, "Cap Augmentin 625mg TDS pc x 7 days", (70, 340), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 0.75, (20, 20, 20), 2)
    cv2.line(img_neat, (30, 520), (520, 520), (40, 40, 40), 1)

    cv2.putText(img_neat, "Signature: Dr. E. Stone, MD", (70, 570), cv2.FONT_HERSHEY_SCRIPT_COMPLEX, 0.8, (20, 20, 20), 2)
    cv2.imwrite(os.path.join(output_dir, "neat_handwriting.png"), img_neat)

    # 3. Messy handwriting style image (with skew, noise, low contrast)
    img_messy = np.full((700, 550, 3), 240, dtype=np.uint8)
    # Add salt and pepper / scan noise
    noise = np.random.randint(0, 25, (700, 550, 3), dtype=np.uint8)
    img_messy = cv2.subtract(img_messy, noise)

    cv2.putText(img_messy, "METRO GENERAL CLINIC", (80, 50), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 0.7, (40, 40, 40), 2)
    cv2.line(img_messy, (30, 95), (510, 95), (60, 60, 60), 1)

    cv2.putText(img_messy, "ID: pt_messy_03  Date: 18/10", (40, 140), cv2.FONT_HERSHEY_SCRIPT_COMPLEX, 0.6, (40, 40, 40), 1)
    cv2.line(img_messy, (30, 165), (510, 165), (60, 60, 60), 1)

    cv2.putText(img_messy, "Rx", (40, 210), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 1.2, (30, 30, 30), 2)
    cv2.putText(img_messy, "Cap Augmentin 625 mg TDS SOS", (60, 275), cv2.FONT_HERSHEY_SCRIPT_COMPLEX, 0.8, (30, 30, 30), 2)
    cv2.putText(img_messy, "Tab Zestril ??? dose illegible", (60, 350), cv2.FONT_HERSHEY_SCRIPT_COMPLEX, 0.75, (30, 30, 30), 2)
    cv2.line(img_messy, (30, 520), (510, 520), (60, 60, 60), 1)

    cv2.putText(img_messy, "Dr. Scribble, MD", (70, 575), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 0.8, (30, 30, 30), 2)

    # Add 4 degree skew rotation to messy image
    center = (275, 350)
    m = cv2.getRotationMatrix2D(center, 4.0, 1.0)
    img_messy = cv2.warpAffine(img_messy, m, (550, 700), borderValue=(245, 245, 245))

    cv2.imwrite(os.path.join(output_dir, "messy.png"), img_messy)
    print("Generated 3 sample prescription images in prescription/samples/")


if __name__ == "__main__":
    generate_sample_images()
