const compactCustomerName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const createPackingListReportFileName = ({
  customer,
  month,
  year,
  downloadedAt = new Date(),
}) => {
  const date = new Date(downloadedAt);
  const pad = (value) => String(value).padStart(2, "0");
  const customerName = compactCustomerName(customer) || "customer";
  return `${customerName}${pad(month)}${String(year).padStart(4, "0")}${pad(date.getSeconds())}${pad(date.getMinutes())}${pad(date.getHours())}.pdf`;
};

module.exports = {
  compactCustomerName,
  createPackingListReportFileName,
};