const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSiteConfiguration,
  sanitizeRemoteFileName,
  sanitizeSftpError,
  validateSiteConfiguration,
} = require("../services/siteSftpService");
const FinishedProduct = require("../models/FinishedProduct");
const RawMaterial = require("../models/RawMaterial");
const BillOfMaterials = require("../models/BOM");
const SPLScrap = require("../models/SPLScrap");
const {
  formatExpectedArrivalDateForDisplay,
} = require("../services/fileConversionService");

const createTestEnvironment = () => ({
  SFTP_HOST: "local-01.test",
  SFTP_PORT: "22",
  SFTP_USERNAME: "local-01-user",
  SFTP_PASSWORD: "local-01-password",
  SFTP_REMOTE_UPLOAD_DIR: "/local-01/inbox",
  SFTP_REMOTE_ERROR_DIR: "/local-01/errors",
  SFTP_2_HOST: "local-02.test",
  SFTP_2_PORT: "2222",
  SFTP_2_USERNAME: "local-02-user",
  SFTP_2_PASSWORD: "local-02-password",
  SFTP_2_REMOTE_UPLOAD_DIR: "/local-02/inbox",
  SFTP_2_REMOTE_ERROR_DIR: "/local-02/errors",
});

test("valida configuraciones SFTP independientes para Local 01 y Local 02", () => {
  const env = createTestEnvironment();

  assert.equal(validateSiteConfiguration("local-01", env).valid, true);
  assert.equal(validateSiteConfiguration("local-02", env).valid, true);

  const local01 = getSiteConfiguration("local-01", env);
  const local02 = getSiteConfiguration("local-02", env);

  assert.equal(local01.remoteUploadDir, "/local-01/inbox");
  assert.equal(local01.remoteErrorDir, "/local-01/errors");
  assert.equal(local02.remoteUploadDir, "/local-02/inbox");
  assert.equal(local02.remoteErrorDir, "/local-02/errors");
  assert.notEqual(local01.host, local02.host);
  assert.notEqual(local01.username, local02.username);
});

test("marca una sede como incompleta sin autenticacion o ruta remota", () => {
  const env = createTestEnvironment();
  delete env.SFTP_2_PASSWORD;
  delete env.SFTP_2_REMOTE_UPLOAD_DIR;
  delete env.SFTP_2_REMOTE_ERROR_DIR;

  const result = validateSiteConfiguration("local-02", env);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.missing.sort(),
    ["authentication", "remoteErrorDir", "remoteUploadDir"].sort(),
  );
});

test("sanea nombres remotos para impedir rutas proporcionadas por el archivo", () => {
  assert.equal(
    sanitizeRemoteFileName("../folder\\unsafe?.txt"),
    "unsafe_.txt",
  );
});

test("los errores publicos SFTP no exponen el mensaje interno", () => {
  const internalError = new Error(
    "unexpected password=do-not-expose privateKey=do-not-expose",
  );
  const publicError = sanitizeSftpError(internalError);

  assert.equal(publicError.code, "SFTP_OPERATION_FAILED");
  assert.equal(
    publicError.message,
    "No se pudo completar la operacion SFTP.",
  );
  assert.equal(publicError.message.includes("do-not-expose"), false);
});

test("los cuatro modelos inician sin envio SFTP", () => {
  const models = [
    [FinishedProduct, "pending"],
    [RawMaterial, "pending"],
    [BillOfMaterials, "pending"],
    [SPLScrap, "not_applicable"],
  ];

  models.forEach(([Model, expectedMfStatus]) => {
    const document = new Model();
    assert.equal(document.sftpDelivery.status, "not_sent");
    assert.equal(document.sftpDelivery.attempts, 0);
    assert.equal(document.masterFileSync.status, expectedMfStatus);
    assert.equal(document.masterFileSync.attempts, 0);
  });
});

test("muestra Expected date of arrival con guiones sin cambiar sus ocho digitos", () => {
  assert.equal(
    formatExpectedArrivalDateForDisplay("20260805"),
    "2026-08-05",
  );
  assert.equal(
    formatExpectedArrivalDateForDisplay("2026-08-05"),
    "2026-08-05",
  );
  assert.equal(
    formatExpectedArrivalDateForDisplay("2026-08-05T00:00:00.000Z"),
    "2026-08-05",
  );
});
