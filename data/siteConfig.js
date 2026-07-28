const SITES = Object.freeze([
  Object.freeze({ value: "local-01", label: "Local 01" }),
  Object.freeze({ value: "local-02", label: "Local 02" }),
]);

const VALID_SITES = Object.freeze(
  SITES.map((site) => site.value),
);

const DEFAULT_SITE = VALID_SITES[0];

module.exports = {
  SITES,
  VALID_SITES,
  DEFAULT_SITE,
};
