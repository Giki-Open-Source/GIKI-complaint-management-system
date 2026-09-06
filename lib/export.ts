import PDFDocument from 'pdfkit'

export interface ExportColumn<T> {
    header: string
    /** Relative width weight used to lay the column out across the page. */
    width: number
    value: (row: T) => string
}

/**
 * Hard-truncates a cell so it can never wrap onto a second line and overlap the
 * next row. pdfkit's own `ellipsis` still wraps in some cases, so measure and cut.
 */
function fitToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (doc.widthOfString(clean) <= maxWidth) return clean

    let lo = 0
    let hi = clean.length
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (doc.widthOfString(clean.slice(0, mid) + '...') <= maxWidth) lo = mid
        else hi = mid - 1
    }
    return clean.slice(0, lo) + '...'
}

/** RFC 4180 style escaping: quote if the field contains a comma, quote or newline. */
function csvCell(value: string): string {
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

export function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
    const lines = [columns.map(c => csvCell(c.header)).join(',')]
    for (const row of rows) {
        lines.push(columns.map(c => csvCell(c.value(row) ?? '')).join(','))
    }
    // Excel opens UTF-8 CSVs correctly only with a BOM.
    return '﻿' + lines.join('\r\n')
}

interface PdfReportOptions {
    title: string
    /** Module code shown top-right, e.g. "HMS-COMPLAINTS-01". */
    moduleCode: string
    filters: string[]
    generatedBy: string
    totalRecords: number
}

/**
 * Renders an ERP-style landscape report: title block, filter criteria, a ruled
 * table with repeating headers, and "Page X of Y" footers.
 */
export function buildPdf<T>(rows: T[], columns: ExportColumn<T>[], opts: PdfReportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        // bufferPages keeps every page in memory so the "Page X of Y" footers can
        // be written once the final page count is known.
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: true })
        const chunks: Buffer[] = []
        doc.on('data', (c: Buffer) => chunks.push(c))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const left = doc.page.margins.left
        const right = doc.page.width - doc.page.margins.right
        const usableWidth = right - left

        const totalWeight = columns.reduce((sum, c) => sum + c.width, 0)
        const colWidths = columns.map(c => (c.width / totalWeight) * usableWidth)
        const colX: number[] = []
        let running = left
        for (const w of colWidths) {
            colX.push(running)
            running += w
        }

        const ROW_HEIGHT = 16
        const HEADER_HEIGHT = 18

        const drawTableHeader = (y: number) => {
            doc.save()
            doc.rect(left, y, usableWidth, HEADER_HEIGHT).fill('#e6e9ed')
            doc.restore()
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5)
            columns.forEach((c, i) => {
                doc.text(fitToWidth(doc, c.header.toUpperCase(), colWidths[i] - 6), colX[i] + 3, y + 5, {
                    width: colWidths[i] - 6,
                    lineBreak: false,
                })
            })
            // Rule under the header
            doc.moveTo(left, y + HEADER_HEIGHT).lineTo(right, y + HEADER_HEIGHT).lineWidth(0.8).strokeColor('#333').stroke()
            return y + HEADER_HEIGHT
        }

        const drawReportHeader = () => {
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(13)
            doc.text('GIKomplain', left, doc.page.margins.top)
            doc.font('Helvetica-Bold').fontSize(10)
            doc.text(opts.title, left, doc.y + 1)

            // Module code + timestamp, right aligned against the title block
            doc.font('Helvetica').fontSize(7.5).fillColor('#444')
            doc.text(`Module: ${opts.moduleCode}`, left, doc.page.margins.top, { width: usableWidth, align: 'right' })
            doc.text(`Generated: ${new Date().toLocaleString()}`, left, doc.y, { width: usableWidth, align: 'right' })
            doc.text(`By: ${opts.generatedBy}`, left, doc.y, { width: usableWidth, align: 'right' })

            doc.fillColor('#000').font('Helvetica').fontSize(7.5)
            const filterY = Math.max(doc.y, doc.page.margins.top + 34)
            doc.text(`Filter criteria: ${opts.filters.join('  |  ')}`, left, filterY, { width: usableWidth })
            doc.text(`Total records: ${opts.totalRecords}`, left, doc.y + 1, { width: usableWidth })

            const lineY = doc.y + 5
            doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(1).strokeColor('#000').stroke()
            return lineY + 7
        }

        let y = drawReportHeader()
        y = drawTableHeader(y)

        const bottomLimit = doc.page.height - doc.page.margins.bottom - 20

        doc.font('Helvetica').fontSize(7.5).fillColor('#000')
        rows.forEach((row, index) => {
            if (y + ROW_HEIGHT > bottomLimit) {
                doc.addPage()
                y = drawReportHeader()
                y = drawTableHeader(y)
                doc.font('Helvetica').fontSize(7.5).fillColor('#000')
            }

            // Zebra striping keeps long ledgers readable in print.
            if (index % 2 === 1) {
                doc.save()
                doc.rect(left, y, usableWidth, ROW_HEIGHT).fill('#f4f6f8')
                doc.restore()
                doc.fillColor('#000')
            }

            columns.forEach((c, i) => {
                doc.text(fitToWidth(doc, c.value(row) ?? '', colWidths[i] - 6), colX[i] + 3, y + 4.5, {
                    width: colWidths[i] - 6,
                    lineBreak: false,
                })
            })

            doc.moveTo(left, y + ROW_HEIGHT).lineTo(right, y + ROW_HEIGHT).lineWidth(0.3).strokeColor('#c9cfd6').stroke()
            y += ROW_HEIGHT
        })

        if (rows.length === 0) {
            doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666')
            doc.text('No records match the selected criteria.', left, y + 8, { width: usableWidth, align: 'center' })
        }

        // Footers must be written after all pages exist so "of Y" is correct.
        const range = doc.bufferedPageRange()
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i)
            doc.font('Helvetica').fontSize(7).fillColor('#555')
            doc.text(
                `Page ${i + 1} of ${range.count}`,
                left,
                doc.page.height - doc.page.margins.bottom - 10,
                { width: usableWidth, align: 'right', lineBreak: false }
            )
            doc.text(
                'GIKomplain - Confidential / Internal Use Only',
                left,
                doc.page.height - doc.page.margins.bottom - 10,
                { width: usableWidth, align: 'left', lineBreak: false }
            )
        }

        doc.end()
    })
}

/** Timestamped, filesystem-safe filename, e.g. hostel-complaints-2026-09-06.csv */
export function exportFilename(base: string, ext: string) {
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return `${base}-${stamp}.${ext}`
}
