import type { RequestHandler } from '@sveltejs/kit';
import { PDFDocument } from 'pdf-lib';
import pdfjs, { type PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { parsePageItems, type Page } from 'pdf-text-reader';

type Area = {
	value: string;
	unit: 'Ha' | 'Aa' | 'Ca';
};

type Parcel = {
	sheetNumber: number;
	parcelNumber: number;
};

type Island = {
	name: string;
	area?: Area[];
	parcels?: Parcel[];
};

let island = [
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

async function takePDFpage(buffer: ArrayBuffer, pdfPage: number) {
	const documentPDF = await pdfjs.getDocument(buffer).promise;
	const currentPage = await documentPDF.getPage(pdfPage);
	const content = await currentPage.getTextContent();
	const items: TextItem[] = content.items.filter((item): item is TextItem => 'str' in item);
	const parsedPage = parsePageItems(items);

	return parsedPage;
}

async function getAllPages(buffer: ArrayBuffer) {
	const pdf = await pdfjs.getDocument(buffer).promise;
	return pdf.numPages;
}

function splitRow(islandRow: string) {
	if (!islandRow) return [];
	const parts = islandRow.split(' ');
	return parts;
}

async function getIslands(buffer: ArrayBuffer) {
	let islands: Island[] = [];
	let sbu: Island[] = [];
	const maxPages = await getAllPages(buffer);

	for (let i = 1; i <= maxPages; i++) {
		const currentPage = await takePDFpage(buffer, i);
		const island = await getIslandsNames(currentPage);
		islands = [...islands, ...island];
		sbu = getArea(islands, currentPage);
	}
	const uniqueIslands: Island[] = [];
	sbu.forEach((island) => {
		let isUnique = true;
		for (const uniqueIsland of uniqueIslands) {
			if (island.area === uniqueIsland.area && island.name === uniqueIsland.name) {
				isUnique = false;
				break;
			}
		}
		if (isUnique) {
			uniqueIslands.push(island);
		}
	});

	return uniqueIslands;
}

function isIslandName(islandName: string) {
	const pattern = /^IT\d{2}\/\d{11}\/[A-Z]{3}\d{2}/;
	const result = pattern.test(islandName);
	return result;
}

function getArea(islands: Island[], currentPage: Page) {
	const pattern = /^\d{2}(,\d{2}){2}$/;
	let newIslands = islands;
	for (let i = 0; i < currentPage.lines.length; i++) {
		let row = splitRow(currentPage.lines[i]);
		if (!row) continue;

		for (let j = 0; j < row.length; j++) {
			if (pattern.test(row[j])) {
				if (isIslandName(row[j - 1])) {
					let areas = row[j].split(',');
					let newArea: Area[] = [
						{ value: areas[0], unit: 'Ha' },
						{ value: areas[1], unit: 'Aa' },
						{ value: areas[2], unit: 'Ca' }
					];
					for (let k = 0; k < newIslands.length; k++) {
						newIslands[k].area = newArea;
						console.log(newArea);
					}
				}
			}
		}
	}
	return newIslands ;
}

async function getIslandsNames(currentPage: Page) {
	let islands: Island[] = [];

	currentPage.lines.forEach((line) => {
		const splittedRow = splitRow(line);

		splittedRow.forEach((str) => {
			const isIslandInside = islands.some((island) => island.name === str);
			if (isIslandInside) {
				return;
			}
			if (isIslandName(str)) {
				islands = [
					...islands,
					{
						name: str
					}
				];
			}
		});
	});
	return islands;
}

export const POST: RequestHandler = async ({ request }) => {
	const buffer = await request.arrayBuffer();
	const result = await getIslands(buffer);
	return new Response(JSON.stringify(result));
};
