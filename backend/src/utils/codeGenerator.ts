import prisma from '../config/prisma';

export const generateInventoryCode = async (
  model: 'ItemCategory' | 'ItemLocation' | 'Vendor' | 'Item',
  prefix: string,
  padding: number = 3
): Promise<string> => {
  let records: any[] = [];
  
  if (model === 'ItemCategory') {
    records = await prisma.itemCategory.findMany({ select: { internal_id: true } });
  } else if (model === 'ItemLocation') {
    records = await prisma.itemLocation.findMany({ select: { internal_id: true } });
  } else if (model === 'Vendor') {
    records = await prisma.vendor.findMany({ select: { internal_id: true } });
  } else if (model === 'Item') {
    records = await prisma.item.findMany({ select: { internal_code: true } });
  }

  let maxNum = 0;
  
  for (const record of records) {
    const code = record.internal_id || record.internal_code;
    if (code && code.startsWith(prefix)) {
      const numPart = code.replace(prefix, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  const numString = nextNum.toString().padStart(padding, '0');
  return `${prefix}${numString}`;
};
