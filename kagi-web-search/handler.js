module.exports.runtime = {
  handler: async function ({ query }) {
    const callerId = `${this.config.name}-v${this.config.version}`;
    try {
      this.introspect(`${callerId} called with query: ${query}`);

      const apiKey = this.runtimeArgs["KAGI_API_KEY"];

      const response = await fetch("https://kagi.com/api/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query, workflow: "search" }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger(`${callerId} HTTP ${response.status}`, errText);
        return `Kagi API returned status ${response.status}: ${errText}`;
      }

      const data = await response.json();
      const results = (data?.data?.search ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      }));

      return JSON.stringify({ results });
    } catch (e) {
      this.introspect(`${callerId} failed. Reason: ${e.message}`);
      this.logger(`${callerId} failed`, e.message);
      return `The tool failed to run for some reason. Here is all we know: ${e.message}`;
    }
  },
};
