// data/masterFileRegistry.js

const MASTER_TYPES = Object.freeze({
  FINISHED_PRODUCT: "finishedProduct",
  RAW_MATERIAL: "rawMaterial",
  BILL_OF_MATERIALS: "billOfMaterials",
});

/**
 * Normaliza un encabezado para poder compararlo.
 *
 * Ejemplos:
 * "Unit Net Weight (g)" -> "unitnetweightg"
 * "Country of Origin"  -> "countryoforigin"
 * "USMIL No."          -> "usmilno"
 */
const normalizeMasterHeader = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
};

/**
 * Reglas de encabezados para Finished Goods.
 *
 * target:
 * Campo dentro de normalizedValues.
 *
 * transform:
 * Indica al futuro parser cómo transformar el valor.
 */
const FINISHED_PRODUCT_HEADER_RULES = Object.freeze({
  partnumber: {
    target: "partNumber",
    transform: "partNumber",
  },

  productfamily: {
    target: "productFamily",
    transform: "text",
  },

  description: {
    target: "description",
    transform: "text",
  },

  unitnetweightg: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "g",
  },

  unitweightlb: {
    target: "unitNetWeight",
    transform: "pounds",
    sourceUnit: "lb",
  },

  materialcostusd: {
    target: "materialCostUsd",
    transform: "number",
  },

  dutiablevalue: {
    target: "dutiableValueUsd",
    transform: "number",
  },

  filler: {
    target: "filler",
    transform: "text",
  },

  addedvalueusd: {
    target: "addedValueUsd",
    transform: "number",
  },

  totalunitcost: {
    target: "totalUnitCostUsd",
    transform: "number",
  },

  unitofmeasure: {
    target: "unitOfMeasure",
    transform: "uom",
  },

  countryoforigin: {
    target: "countryOfOrigin",
    transform: "country",
  },

  usaimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  usimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  usaexportationcode: {
    target: "exportationHtsCode",
    transform: "hts",
  },

  usmilno: {
    target: "usmlItar",
    transform: "text",
  },

  fdaproductcode: {
    target: "fdaProductCode",
    transform: "text",
  },

  fdastorage: {
    target: "fdaStorage",
    transform: "text",
  },

  fdacountryorigin: {
    target: "fdaCountryOfOrigin",
    transform: "country",
  },

  fdamarker: {
    target: "fdaMarker",
    transform: "uppercaseText",
  },

  fdaaffirmationofcompliancecode1: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 1,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier1: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 1,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode2: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 2,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier2: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 2,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode3: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 3,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier3: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 3,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode4: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 4,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier4: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 4,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode5: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 5,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier5: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 5,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode6: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 6,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier6: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 6,
    component: "qualifier",
  },

  descriptionforcustomspurposes: {
    target: "descriptionForCustoms",
    transform: "text",
  },

  compositionmaterial: {
    target: "compositionMaterial",
    transform: "text",
  },

  mainfunction: {
    target: "mainFunction",
    transform: "text",
  },

  technicalinformation: {
    target: "technicalInformation",
    transform: "text",
  },

  spanishdescription: {
    target: "spanishDescription",
    transform: "text",
  },

  mxtariffcode: {
    target: "mxTariffCode",
    transform: "hts",
  },

  regulations: {
    target: "regulations",
    transform: "text",
  },

  comentarios: {
    target: "comments",
    transform: "text",
  },

  comments: {
    target: "comments",
    transform: "text",
  },

  clientcomments: {
    target: "clientComments",
    transform: "text",
  },

  unnamedcolumnak: {
    target: "frontRear",
    transform: "uppercaseText",
  },
});

/**
 * Reglas para Raw Material.
 */
const RAW_MATERIAL_HEADER_RULES = Object.freeze({
  partnumber: {
    target: "partNumber",
    transform: "partNumber",
  },

  itemtypebygroupproductfamily: {
    target: "productFamily",
    transform: "text",
  },

  customerdescription: {
    target: "description",
    transform: "text",
  },

  description: {
    target: "description",
    transform: "text",
  },

  unitnetweightkgs: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "kg",
  },

  unitnetweightkg: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "kg",
  },

  unitnetweightlbs: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "lb",
  },

  unitnetweightlb: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "lb",
  },

  unitweightlb: {
    target: "unitNetWeight",
    transform: "pounds",
    sourceUnit: "lb",
  },

  unitvalueusd: {
    target: "unitCostUsd",
    transform: "number",
  },

  unitcostusd: {
    target: "unitCostUsd",
    transform: "number",
  },

  unitcostuds: {
    target: "unitCostUsd",
    transform: "number",
  },

  unitofmeasure: {
    target: "unitOfMeasure",
    transform: "uom",
  },

  uom: {
    target: "uom",
    transform: "text",
  },

  countryoforigin: {
    target: "countryOfOrigin",
    transform: "country",
  },

  usimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  usaimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  importationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  exportationhtscode: {
    target: "exportationHtsCode",
    transform: "hts",
  },

  eccn: {
    target: "eccn",
    transform: "uppercaseText",
  },

  filler: {
    target: "filler",
    transform: "text",
  },

  licensenumberlcn: {
    target: "licenseNumber",
    transform: "text",
  },

  licenseexception: {
    target: "licenseException",
    transform: "text",
  },

  licenseexpirationdate: {
    target: "licenseExpirationDate",
    transform: "date",
  },

  usmlitar: {
    target: "usmlItar",
    transform: "text",
  },

  descriptionforcustomspurposesenglish: {
    target: "descriptionForCustoms",
    transform: "text",
  },

  descriptionforcustomspurposes: {
    target: "descriptionForCustoms",
    transform: "text",
  },

  technicalinformationcompositionmaterial: {
    target: "technicalInformation",
    transform: "text",
  },

  compositionmaterial: {
    target: "compositionMaterial",
    transform: "text",
  },

  functionandspecificuse: {
    target: "mainFunction",
    transform: "text",
  },

  mainfunction: {
    target: "mainFunction",
    transform: "text",
  },

  spanishdescription: {
    target: "spanishDescription",
    transform: "text",
  },

  mxtariffcode: {
    target: "mxTariffCode",
    transform: "hts",
  },

  regulations: {
    target: "regulations",
    transform: "text",
  },

  comments: {
    target: "comments",
    transform: "text",
  },

  comentarios: {
    target: "comments",
    transform: "text",
  },

  clientcomments: {
    target: "clientComments",
    transform: "text",
  },

});

/**
 * Configuración de los tres tipos de archivos madre.
 *
 * No se configura por nombre de archivo porque el usuario puede
 * renombrarlo. Se detecta usando la hoja y los encabezados.
 */
const BILL_OF_MATERIALS_HEADER_RULES = Object.freeze({
  finishedgoodpartnumber: {
    target: "partNumber",
    transform: "partNumber",
  },

  componentpartnumber: {
    target: "componentPartNumber",
    transform: "partNumber",
  },

  type: {
    target: "componentType",
    transform: "uppercaseText",
  },

  quantity: {
    target: "quantity",
    transform: "number",
  },

  unitofmeasure: {
    target: "unitOfMeasure",
    transform: "uom",
  },
});

const MASTER_FILE_REGISTRY = Object.freeze({
  [MASTER_TYPES.FINISHED_PRODUCT]: Object.freeze({
    masterType: MASTER_TYPES.FINISHED_PRODUCT,

    displayName: "Finished Goods",

    sheetNames: [
      "FS E",
    ],

    ignoredSheetNames: [
      "Catalogs",
      "keys",
    ],

    headerRow: 1,

    ignoreUnnamedHeaders: true,

    partNumberHeaderKeys: [
      "partnumber",
      "partno",
    ],

    ignoredHeaderKeys: [
      "image",
    ],

    requiredHeaderKeys: [
      "partnumber",
      "description",
    ],

    headerRules: FINISHED_PRODUCT_HEADER_RULES,
  }),

  [MASTER_TYPES.RAW_MATERIAL]: Object.freeze({
    masterType: MASTER_TYPES.RAW_MATERIAL,

    displayName: "Raw Material",

    sheetNames: [
      "RM E",
    ],

    ignoredSheetNames: [
      "Catalogs",
      "keys",
    ],

    headerRow: 1,

    ignoreUnnamedHeaders: true,

    partNumberHeaderKeys: [
      "partnumber",
      "partno",
    ],

    ignoredHeaderKeys: [
      "image",
    ],

    requiredHeaderKeys: [
      "partnumber",
      "description",
    ],

    headerRules: RAW_MATERIAL_HEADER_RULES,
  }),

  [MASTER_TYPES.BILL_OF_MATERIALS]: Object.freeze({
    masterType: MASTER_TYPES.BILL_OF_MATERIALS,

    displayName: "Bill of Materials",

    sheetNames: [
      "BOM E",
    ],

    ignoredSheetNames: [],

    headerRow: 1,

    ignoreUnnamedHeaders: true,

    allowDuplicatePartNumbers: true,

    partNumberHeaderKeys: [
      "finishedgoodpartnumber",
    ],

    ignoredHeaderKeys: [],

    requiredHeaderKeys: [
      "finishedgoodpartnumber",
      "componentpartnumber",
      "type",
      "quantity",
      "unitofmeasure",
    ],

    headerRules: BILL_OF_MATERIALS_HEADER_RULES,
  }),
});

/**
 * Busca la configuración por tipo interno.
 */
const getMasterFileConfig = (masterType) => {
  const config = MASTER_FILE_REGISTRY[masterType];

  if (!config) {
    throw new Error(
      `Tipo de archivo madre desconocido: ${masterType}`,
    );
  }

  return config;
};

/**
 * Detecta el tipo según las hojas encontradas en el workbook.
 */
const detectMasterTypeBySheetNames = (sheetNames = []) => {
  const normalizedSheetNames = sheetNames.map((name) =>
    String(name || "").trim().toLowerCase(),
  );

  for (const config of Object.values(MASTER_FILE_REGISTRY)) {
    const matches = config.sheetNames.some((expectedName) =>
      normalizedSheetNames.includes(
        expectedName.toLowerCase(),
      ),
    );

    if (matches) {
      return config.masterType;
    }
  }

  return null;
};

/**
 * Obtiene la regla de mapeo de un encabezado.
 */
const getMasterHeaderRule = (
  masterType,
  originalHeader,
) => {
  const config = getMasterFileConfig(masterType);
  const normalizedHeader =
    normalizeMasterHeader(originalHeader);

  return (
    config.headerRules[normalizedHeader] || null
  );
};

/**
 * Indica si una columna debe ignorarse.
 */
const shouldIgnoreMasterHeader = (
  masterType,
  originalHeader,
) => {
  const config = getMasterFileConfig(masterType);
  const normalizedHeader =
    normalizeMasterHeader(originalHeader);

  return config.ignoredHeaderKeys.includes(
    normalizedHeader,
  );
};

module.exports = {
  MASTER_TYPES,
  MASTER_FILE_REGISTRY,
  normalizeMasterHeader,
  getMasterFileConfig,
  detectMasterTypeBySheetNames,
  getMasterHeaderRule,
  shouldIgnoreMasterHeader,
};
