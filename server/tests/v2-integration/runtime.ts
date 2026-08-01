let baseUrl = "";

const setBaseUrl = (url: string) => {
  baseUrl = url;
};

const getBaseUrl = () => {
  if (!baseUrl) {
    throw new Error("Test base URL has not been initialized");
  }

  return baseUrl;
};

export { setBaseUrl, getBaseUrl };
