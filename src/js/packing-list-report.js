const form = document.getElementById("reportForm");
const siteGroup = document.getElementById("siteGroup");
const siteInput = document.getElementById("site");
const customerInput = document.getElementById("customer");
const monthInput = document.getElementById("month");
const yearInput = document.getElementById("year");
const message = document.getElementById("message");
const downloadButton = document.getElementById("downloadButton");

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

let currentUser = null;
let availablePeriods = [];

const showError = (text = "") => {
  message.textContent = text;
  message.className = text ? "message error" : "message";
};

const readJsonResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "No se pudo completar la solicitud.");
  }
  return data;
};

const resetPeriods = (label = "Selecciona un customer") => {
  availablePeriods = [];
  yearInput.innerHTML = `<option value="">${label}</option>`;
  monthInput.innerHTML = `<option value="">${label}</option>`;
  yearInput.disabled = true;
  monthInput.disabled = true;
  downloadButton.disabled = true;
};

const appendSite = (params) => {
  if (currentUser?.role === "admin" && siteInput.value) {
    params.set("site", siteInput.value);
  }
  return params;
};

const fillMonths = () => {
  const selected = availablePeriods.find(
    (period) => String(period.year) === yearInput.value,
  );
  monthInput.innerHTML = '<option value="">Selecciona un mes</option>';
  (selected?.months || []).forEach((month) => {
    monthInput.add(new Option(monthNames[month - 1], month));
  });
  monthInput.disabled = !selected;
  downloadButton.disabled = true;
};

const loadPeriods = async () => {
  resetPeriods("Cargando fechas...");
  showError();
  if (!customerInput.value) {
    resetPeriods();
    return;
  }
  try {
    const params = appendSite(new URLSearchParams({
      customer: customerInput.value,
    }));
    const response = await fetch(
      `/api/packing-list-reports/periods?${params.toString()}`,
    );
    const data = await readJsonResponse(response);
    availablePeriods = Array.isArray(data.periods) ? data.periods : [];
    if (!availablePeriods.length) {
      resetPeriods("Sin fechas disponibles");
      return;
    }
    yearInput.innerHTML = '<option value="">Selecciona un año</option>';
    availablePeriods.forEach((period) => {
      yearInput.add(new Option(period.year, period.year));
    });
    yearInput.disabled = false;
    monthInput.innerHTML = '<option value="">Selecciona un año primero</option>';
  } catch (error) {
    resetPeriods("No disponible");
    showError(error.message);
  }
};

const loadCustomers = async () => {
  customerInput.disabled = true;
  customerInput.innerHTML = '<option value="">Cargando customers...</option>';
  resetPeriods();
  showError();
  if (currentUser?.role === "admin" && !siteInput.value) {
    customerInput.innerHTML =
      '<option value="">Selecciona una sede primero</option>';
    return;
  }
  try {
    const params = appendSite(new URLSearchParams());
    const response = await fetch(
      `/api/packing-list-reports/customers?${params.toString()}`,
    );
    const data = await readJsonResponse(response);
    customerInput.innerHTML =
      '<option value="">Selecciona un customer</option>';
    (data.customers || []).forEach((name) => {
      customerInput.add(new Option(name, name));
    });
    customerInput.disabled = false;
  } catch (error) {
    customerInput.innerHTML = '<option value="">No disponible</option>';
    showError(error.message);
  }
};

const getDownloadName = (response) => {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "packing-list-report.pdf";
};

const initialize = async () => {
  const response = await fetch("/api/user/profile");
  const data = await readJsonResponse(response);
  currentUser = data.user;

  customerInput.addEventListener("change", loadPeriods);
  yearInput.addEventListener("change", fillMonths);
  monthInput.addEventListener("change", () => {
    downloadButton.disabled = !monthInput.value;
  });

  if (currentUser.role === "admin") {
    siteGroup.classList.remove("hidden");
    siteInput.addEventListener("change", loadCustomers);
  }
  await loadCustomers();
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError();
  downloadButton.disabled = true;
  downloadButton.textContent = "Generando PDF...";
  try {
    const params = appendSite(new URLSearchParams({
      customer: customerInput.value,
      month: monthInput.value,
      year: yearInput.value,
    }));
    const response = await fetch(
      `/api/packing-list-reports/monthly.pdf?${params.toString()}`,
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "No se pudo generar el reporte.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDownloadName(response);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    showError(error.message || "No se pudo descargar el reporte.");
  } finally {
    downloadButton.disabled = !monthInput.value;
    downloadButton.textContent = "Descargar PDF";
  }
});

initialize().catch(() => {
  showError("No se pudo cargar la pantalla.");
});