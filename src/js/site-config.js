export const USER_SITES = Object.freeze([
  Object.freeze({ value: "local-01", label: "Local 01" }),
  Object.freeze({ value: "local-02", label: "Local 02" }),
]);

export const formatSite = (siteValue) => {
  const site = USER_SITES.find(
    ({ value }) => value === siteValue,
  );

  return site?.label || siteValue || "";
};
