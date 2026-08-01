let baseUrl = "";

const setBaseUrl = (nextBaseUrl: string) => {
  baseUrl = nextBaseUrl;
};

const getBaseUrl = () => {
  if (!baseUrl) {
    throw new Error("V3 test base URL is not initialized");
  }

  return baseUrl;
};

export { setBaseUrl, getBaseUrl };
