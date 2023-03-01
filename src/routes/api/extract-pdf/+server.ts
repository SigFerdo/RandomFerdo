import type { RequestHandler } from '@sveltejs/kit';
import pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { parsePageItems, type Page } from 'pdf-text-reader';

type Area = {
	value: number;
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

const getPages = async (buffer: ArrayBuffer) => {
	let pages: Page[] = [];

	const documentPDF = await pdfjs.getDocument(buffer).promise;
	const numPages = documentPDF.numPages;

	for (let i = 1; i <= numPages; i++) {
		const currentPage = await documentPDF.getPage(i);
		const content = await currentPage.getTextContent();
		const items: TextItem[] = content.items.filter((item): item is TextItem => 'str' in item);
		const parsedPage = parsePageItems(items);

		pages = [...pages, parsedPage];
	}

	return pages;
};

const splitRow = (islandRow: string) => {
	if (!islandRow) return [];
	const parts = islandRow.split(' ');
	return parts;
};

const isIslandName = (islandName: string) => {
	const pattern = /^IT\d{2}\/\d{11}\/[A-Z]{3}\d{2}/;
	const result = pattern.test(islandName);
	return result;
};

const isArea = (area: string) => {
	const pattern = /^\d+(,\d+){2}$/;
	const result = pattern.test(area);
	return result;
};

const getIslandNames = (line: string) => {
	let islandNames: string[] = [];
	let splittedRow = splitRow(line);
	splittedRow.forEach((word) => {
		if (isIslandName(word)) {
			islandNames.push(word);
		}
	});

	return Array.from(new Set(islandNames));
};

const getIslands = (pages: Page[]) => {
	let islands: Island[] = [];
	let flag = false;
	pages.forEach((page, indexPage) => {
		page.lines.forEach((line, indexLine) => {
			if (!flag) {
				const splittedRow = splitRow(line);
				if (splittedRow[0] === 'Identificativo') {
					console.log('enters');
					flag = true;
				} else {
					const names = getIslandNames(line);
					names.forEach((name, index) => {
						const island: Island = {
							name: name,
							area: getIslandAreas(line)[index],
							parcels: getParcels(pages, indexPage, indexLine + 1)
						};
						islands.push(island);
					});
				}
			}
		});
	});
	return islands;
};

const test = () => {};
const getParcels = (pages: Page[], indexPage: number, indexLine: number) => {
	let parcel: Parcel[] = [];
	//ciclo per ogni riga
	for (let k = indexLine; k < pages[indexPage].lines.length; k++) {
		let splittedRow = splitRow(pages[indexPage].lines[k]);

		//siccome le paricelle splittate hanno lunghezza 3, allora controllo se la lunghezza è 3
		if (splittedRow.length === 3) {
			let newParcel: Parcel = {
				sheetNumber: Number(splittedRow[1]),
				parcelNumber: Number(splittedRow[2])
			};
			parcel.push(newParcel);
		} else if (splittedRow[0] === 'Identificativo') {
			//controllo se l'elenco è finito
			return parcel;
		} else {
			break;
		}
	}
	return parcel;
};

const getIslandAreas = (line: string) => {
	let islandAreas: Area[][] = [];
	let splittedRow = splitRow(line);

	splittedRow.forEach((word, index) => {
		if (isIslandName(word) && isArea(splittedRow[index + 1])) {
			let area = splittedRow[index + 1].split(',');
			let newArea: Area[] = [
				{ value: Number(area[0]), unit: 'Ha' },
				{ value: Number(area[1]), unit: 'Aa' },
				{ value: Number(area[2]), unit: 'Ca' }
			];
			islandAreas.push(newArea);
		}
	});

	return Array.from(new Set(islandAreas));
};

export const POST: RequestHandler = async ({ request }) => {
	const buffer = await request.arrayBuffer();
	const pages = await getPages(buffer);
	const island = getIslands(pages);

	return new Response(JSON.stringify(island));
};
