export type PhlebotomyLabelPayload = {
    sampleId: string;
    patientName: string;
    pid: string;
    testCodes: string[];
    /** Tube enum code e.g. EDTA_PURPLE or humanized label text */
    tubeTypeLabel: string;
    /** Hex colour carried on the sample payload, sourced from the stocked tube in supplies. */
    tubeColor?: string | null;
};

export function getBarcodeBars(sampleId: string, count = 24): number[] {
    return Array.from({ length: count }, (_, i) => {
        const code = sampleId.charCodeAt(i % Math.max(sampleId.length, 1)) || 1;
        return code % 3 === 0 ? 3 : code % 2 === 0 ? 2 : 1;
    });
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Grey is not a tube colour — it flags a tube type with no stocked container to read a colour from. */
export function getTubeHexColor(tubeColor?: string | null): string {
    // Operator-supplied inventory data that lands inside a style attribute, so the shape is
    // checked here instead of trusted.
    const trimmed = tubeColor?.trim() ?? '';
    return HEX_COLOR_PATTERN.test(trimmed) ? trimmed : '#9ca3af';
}

/**
 * Opens the specimen bedside label (visual barcode + tube accent) in a print-target window.
 * Caller should persist print counts via API before or after; this only renders HTML.
 */
export function openPhlebotomySpecimenLabelPrint(payload: PhlebotomyLabelPayload): boolean {
    const printWindow = window.open('', '_blank', 'width=420,height=320');
    if (!printWindow) {
        return false;
    }

    const barcodeBars = getBarcodeBars(payload.sampleId, 32)
        .map(
            (width) =>
                `<span style="display:inline-block;width:${width}px;height:42px;background:#111827;margin-right:1px"></span>`
        )
        .join('');
    const tubeHexColor = getTubeHexColor(payload.tubeColor);

    printWindow.document.write(`
                <!doctype html>
                <html>
                    <head>
                        <title>${payload.sampleId} Label</title>
                        <style>
                            @page { size: 80mm 45mm; margin: 0; }
                            * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                            html, body {
                                width: 80mm;
                                height: 45mm;
                                margin: 0;
                                padding: 0;
                                overflow: hidden;
                                font-family: Arial, sans-serif;
                                color: #0f172a;
                                background: #ffffff;
                            }
                            .label {
                                width: 76mm;
                                height: 41mm;
                                margin: 2mm;
                                border: 1px solid #cbd5e1;
                                padding: 8px;
                                overflow: hidden;
                            }
                            .top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
                            .sample { font-size: 15px; font-weight: 700; }
                            .patient { font-size: 11px; margin-top: 4px; color: #475569; }
                            .tube { display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 10px; color: #64748b; text-align: right; }
                            .tube-dot { width: 10px; height: 10px; border-radius: 999px; background: ${tubeHexColor}; border: 1px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; }
                            .side-strip { width: 4mm; height: 24mm; border-radius: 999px; background: ${tubeHexColor}; flex: 0 0 auto; }
                            .body-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
                            .content { flex: 1; min-width: 0; }
                            .tests { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; max-height: 18px; overflow: hidden; }
                            .test { font-size: 9px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 4px; }
                            .barcode { white-space: nowrap; line-height: 0; overflow: hidden; }
                            .barcode-text { font-size: 9px; text-align: center; margin-top: 3px; letter-spacing: 1px; }
                        </style>
                    </head>
                    <body>
                        <div class="label">
                            <div class="top">
                                <div>
                                    <div class="sample">${payload.sampleId}</div>
                                    <div class="patient">${payload.patientName} • ${payload.pid}</div>
                                </div>
                                <div class="tube"><span class="tube-dot"></span>${payload.tubeTypeLabel.replace(/_/g, ' ')}</div>
                            </div>
                            <div class="body-row">
                                <div class="side-strip"></div>
                                <div class="content">
                                    <div class="tests">
                                        ${payload.testCodes.map((code) => `<span class="test">${code}</span>`).join('')}
                                    </div>
                                    <div class="barcode">${barcodeBars}</div>
                                    <div class="barcode-text">${payload.sampleId}</div>
                                </div>
                            </div>
                        </div>
                        <script>
                            window.onload = () => {
                                window.focus();
                                window.print();
                                window.close();
                            };
                        </script>
                    </body>
                </html>
            `);
    printWindow.document.close();
    return true;
}
