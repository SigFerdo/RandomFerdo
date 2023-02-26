import type { RequestHandler } from '@sveltejs/kit';
import { PDFDocument } from 'pdf-lib';
import pdfjs, { type PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { parsePageItems } from 'pdf-text-reader';

const island = [
	{
		name: '',
		area: [
			{ value: 12, unit: 'Ha' },
			{ value: 12, unit: 'Aa' },
			{ value: 12, unit: 'Ca' }
		],
		parcels: [
			{
				sheetNumber: 45,
				parcelNumber: 6
			}
		]
	}
];

function isFiscalCode(fiscalCode: string): boolean {
	const fiscalCodeExpression = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\s$/;

	return fiscalCodeExpression.test(fiscalCode);
}

async function splitPDF(buffer: ArrayBuffer, index: number) {
	const readPDF = await PDFDocument.load(buffer);
	const writePDF = await PDFDocument.create();
	const [page] = await writePDF.copyPages(readPDF, [index]);
	writePDF.addPage(page);

	return convertToBuffer(writePDF);
}

async function convertToBuffer(pdf: PDFDocument) {
	const bytes = await pdf.save();
	const blob = new Blob([bytes], { type: 'applications/pdf' });
	const buffer = Buffer.from(await blob.arrayBuffer());

	return buffer;
}

async function getFiscalCodeRow(pdf: PDFDocumentProxy, currentPDFPage: number) {
	const currentPage = await pdf.getPage(currentPDFPage);
	const content = await currentPage.getTextContent();
	const items: TextItem[] = content.items.filter((item): item is TextItem => 'str' in item);
	const parsedPage = parsePageItems(items);
	const cf = parsedPage.lines[23];
	return cf;
}

async function addEmployee(buffer: ArrayBuffer) {
	let employeeArray: Employee[] = [];
	const documentPDF = await pdfjs.getDocument(buffer).promise;
	const maxPages = documentPDF.numPages;

	for (let i = 1; i <= maxPages; i++) {
		const fiscalCodeRow = await getFiscalCodeRow(documentPDF, i);

		if (isFiscalCode(fiscalCodeRow)) {
			let currentPageBuffer = splitPDF(buffer, i);
			const isFiscalCodeInside: boolean = employeeArray.some(
				(employee) => employee.cf === fiscalCodeRow.trim()
			);

			if (isFiscalCodeInside) {
				continue;
			}

			employeeArray.push({
				cf: fiscalCodeRow.trim(),
				pageBuffer: await currentPageBuffer
			});
		}
	}
	return employeeArray;
}

export const POST: RequestHandler = async ({ request }) => {
	const buffer = await request.arrayBuffer();
	const result = await addEmployee(buffer);

	return new Response(JSON.stringify(result));
};
