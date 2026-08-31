[Skip to main content](https://docs.crustdata.com/web-docs/quickstart#content-area)

You are viewing the documentation of the new API versions. We would love to hear from you. You can write to use at [support@crustdata.tech](mailto:support@crustdata.tech) for feedback and clarifications.

[Crustdata Docs home page![light logo](https://mintcdn.com/crustdata/D_7b8rIJs3leJu3M/logo/crustdata-logo-full-black.png?fit=max&auto=format&n=D_7b8rIJs3leJu3M&q=85&s=4be4304c52a005d9356a20bad429a965)![dark logo](https://mintcdn.com/crustdata/D_7b8rIJs3leJu3M/logo/crustdata-logo-full-white.png?fit=max&auto=format&n=D_7b8rIJs3leJu3M&q=85&s=d4ae3a6c89ef13ad4eb1a4b0b341d33c)](https://docs.crustdata.com/)

Search...

Ctrl KAsk AI

Search...

Navigation

Web

Web APIs

[Documentation](https://docs.crustdata.com/general/introduction) [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction)

##### Documentation

- [Introduction](https://docs.crustdata.com/general/introduction)
- [Pricing](https://docs.crustdata.com/general/pricing)
- [Rate limits](https://docs.crustdata.com/general/rate-limits)
- [MCP Server](https://docs.crustdata.com/general/mcp)

##### Products

- Company

- Person

- Web

  - [Quickstart](https://docs.crustdata.com/web-docs/quickstart)
  - [Search](https://docs.crustdata.com/web-docs/search)
  - [Fetch](https://docs.crustdata.com/web-docs/fetch)
  - [Examples](https://docs.crustdata.com/web-docs/examples)

close

On this page

- [At a glance](https://docs.crustdata.com/web-docs/quickstart#at-a-glance)
- [Before you start](https://docs.crustdata.com/web-docs/quickstart#before-you-start)
- [Quickstart: search the web](https://docs.crustdata.com/web-docs/quickstart#quickstart-search-the-web)
- [End-to-end: Search → Company Enrich](https://docs.crustdata.com/web-docs/quickstart#end-to-end-search-%E2%86%92-company-enrich)
- [Which API should you start with?](https://docs.crustdata.com/web-docs/quickstart#which-api-should-you-start-with)
- [Common workflows](https://docs.crustdata.com/web-docs/quickstart#common-workflows)
- [Choosing a search source](https://docs.crustdata.com/web-docs/quickstart#choosing-a-search-source)
- [Cross-API workflow map](https://docs.crustdata.com/web-docs/quickstart#cross-api-workflow-map)
- [Error handling](https://docs.crustdata.com/web-docs/quickstart#error-handling)
- [Next steps](https://docs.crustdata.com/web-docs/quickstart#next-steps)

The Web APIs give you programmatic access to web search and webpage content fetching. Search across web, news, academic, deep research mode, and social media sources — or fetch the raw HTML of any public URL.

[**Web Search** \\
\\
Search the web across 7 source types: web, news, academic articles,\\
academic authors, deep research mode, social, and enriched academic.](https://docs.crustdata.com/web-docs/search)

[**Web Fetch** \\
\\
Fetch the HTML content of up to 10 public URLs in one request for\\
content extraction and analysis.](https://docs.crustdata.com/web-docs/fetch)

## [​](https://docs.crustdata.com/web-docs/quickstart\#at-a-glance)  At a glance

|  | Search | Fetch |
| --- | --- | --- |
| **Endpoint** | `POST /web/search/live` | `POST /web/enrich/live` |
| **Required fields** | `query` | `urls` |
| **Optional fields** | `location`, `sources`, `site`, `start_date`, `end_date`, `human_mode`, `page` | `human_mode` |
| **Response shape** | Object with `success`, `query`, `timestamp`, `results[]`, `metadata` | Array of `{ success, url, timestamp, title, content }` |
| **Pagination** | `page` (request multiple pages) | — |
| **Max items per request** | ~10 results per page _(platform behavior)_ | 10 URLs |
| **Timestamp unit** | Milliseconds | Seconds |
| **Error codes** | `400`, `401` | `400`, `401` |

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#before-you-start)  Before you start

You need:

- A Crustdata API key
- A terminal with `curl` (or any HTTP client)
- The required header: `x-api-version: 2025-11-01`

**Convention used in these docs:** Information labeled “OpenAPI contract”
reflects the formal API specification. Information labeled “Current platform
behavior” (such as rate limits and credit costs) describes observed behavior
that may change. See the [API\\
reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction) for the formal OpenAPI
spec.

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#quickstart-search-the-web)  Quickstart: search the web

The fastest way to get started is a simple web search. This single request returns search results with titles, URLs, snippets, and positions.

Request

Response

```
curl --request POST \
  --url https://api.crustdata.com/web/search/live \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "query": "crustdata",
    "sources": ["web"],
    "location": "US"
  }'
```

Response trimmed for clarity.

The response contains:

- **`success`** — whether the search executed successfully.
- **`results[]`** — an array of search results, each with `source`, `title`, `url`, `snippet`, and `position`.
- **`metadata.totalResults`** — the total number of results available (may exceed the displayed count if you didn’t request all pages).

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#end-to-end-search-%E2%86%92-company-enrich)  End-to-end: Search → Company Enrich

The most common workflow chains a web search with a downstream Crustdata API call. Here is a complete 3-step example:

1

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Search for a company's website

```
curl --request POST \
  --url https://api.crustdata.com/web/search/live \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{"query": "ADAMSBROWN, LLC website", "sources": ["web"]}'
```

**Extract:**`results[0].url` → `"https://www.adamsbrowncpa.com/"`

2

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Normalize the URL to a domain

```
const domain = new URL("https://www.adamsbrowncpa.com/")
  .hostname.replace("www.", ""); // "adamsbrowncpa.com"
```

3

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Enrich the company via Company API

```
curl --request POST \
  --url https://api.crustdata.com/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{"domains": ["adamsbrowncpa.com"]}'
```

This returns the full company profile: name, headcount, funding, industry, and more.

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#which-api-should-you-start-with)  Which API should you start with?

| If you want to… | Start with |
| --- | --- |
| Find companies, news, academic papers, or social mentions | [Search](https://docs.crustdata.com/web-docs/search) |
| Get the HTML content of specific URLs for processing | [Fetch](https://docs.crustdata.com/web-docs/fetch) |
| Do both — search then fetch the top results | Search first, then Fetch the URLs |

## [​](https://docs.crustdata.com/web-docs/quickstart\#common-workflows)  Common workflows

1

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Competitive intelligence

[Search](https://docs.crustdata.com/web-docs/search) for a competitor’s name across `news` and
`web` sources, then [Fetch](https://docs.crustdata.com/web-docs/fetch) the top result URLs to
extract full article content.

2

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Find company domain → Enrich

[Search](https://docs.crustdata.com/web-docs/search) with the company name + “website” to discover
the domain (first result URL). Then pass it to the [Company Enrich\\
API](https://docs.crustdata.com/company-docs/enrichment) for the full company profile.

3

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Find LinkedIn → Identify company

[Search](https://docs.crustdata.com/web-docs/search) with the company name and `site:             "linkedin.com/company"` to get the LinkedIn URL. Then pass it to the
[Company Identify API](https://docs.crustdata.com/company-docs/identify).

4

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Find person → Enrich

[Search](https://docs.crustdata.com/web-docs/search) with a person’s name and `site:             "linkedin.com/in"` to find their LinkedIn profile URL. Then pass it to
the [Person Enrich API](https://docs.crustdata.com/person-docs/enrichment).

5

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Academic research

[Search](https://docs.crustdata.com/web-docs/search) with `sources: ["scholar-articles"]` to find
papers with citation data, or `sources: ["scholar-author"]` to get full
author profiles with h-index metrics.

6

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

AI-powered answers

[Search](https://docs.crustdata.com/web-docs/search) with `sources: ["ai"]` to get an AI-generated
overview with source references.

7

[Navigate to header](https://docs.crustdata.com/web-docs/quickstart#)

Content monitoring

[Fetch](https://docs.crustdata.com/web-docs/fetch) the same set of URLs on a schedule and diff the
`content` field to detect changes.

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#choosing-a-search-source)  Choosing a search source

The Web Search API supports seven source types. Each returns a different result shape — always specify `sources` explicitly for predictable parsing.

| Source | What it returns | Safe to pass `url` to Fetch? | Typical downstream action |
| --- | --- | --- | --- |
| `web` | Standard web results | Yes | Fetch page content, discover domains/profiles |
| `news` | News articles | Yes | Fetch full article, monitor press coverage |
| `scholar-articles` | Academic articles | Yes | Download PDF via `pdf_url`, analyze citations |
| `scholar-articles-enriched` | Articles with richer author data | Yes | Same as above, plus follow author profiles |
| `scholar-author` | Researcher profiles | No | Read citation metrics and publications directly from the result |
| `ai` | AI-generated overview | No | Use `content` directly; fetch `references[].url` for source articles |
| `social` | Social media posts | Yes | Monitor social mentions |

**For Fetch workflows:** Only pass URLs from sources marked “Yes” in the
fetchable `url` column directly to [Web Fetch](https://docs.crustdata.com/web-docs/fetch). For AI
results, fetch the `references[].url` values instead. For scholar-author
results, the `url` is a profile page, not a content page.

**OpenAPI contract:** The `site`, `start_date`, and `end_date` parameters
are defined in the spec. **Current platform behavior:** These parameters
primarily affect `web` and `news` results. `scholar-author` and `ai`
searches may not filter by these parameters.

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#cross-api-workflow-map)  Cross-API workflow map

The Web APIs are often the first step in a larger pipeline. Here’s how they connect to other Crustdata APIs:

| Starting point | Web Search query pattern | Extract from result | Pass to |
| --- | --- | --- | --- |
| Company name → company profile | `"ACME Inc website"`, `sources: ["web"]` | `results[0].url` → domain | [Company Enrich](https://docs.crustdata.com/company-docs/enrichment) (`domains`) |
| Company name → identify company | `"ACME Inc"`, `site: "linkedin.com/company"` | `results[0].url` → LinkedIn | [Company Identify](https://docs.crustdata.com/company-docs/identify) (`professional_network_profile_urls`) |
| Person name → person profile | `"Jane Smith Google"`, `site: "linkedin.com/in"` | `results[0].url` → LinkedIn | [Person Enrich](https://docs.crustdata.com/person-docs/enrichment) (`professional_network_profile_urls`) |
| Any search → full article content | Any search query | `results[].url` | [Web Fetch](https://docs.crustdata.com/web-docs/fetch) (`urls`) |
| AI overview → source articles | `"topic"`, `sources: ["ai"]` | `results[0].references[].url` | [Web Fetch](https://docs.crustdata.com/web-docs/fetch) (`urls`) |

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#error-handling)  Error handling

* * *

## [​](https://docs.crustdata.com/web-docs/quickstart\#next-steps)  Next steps

- [Web Search](https://docs.crustdata.com/web-docs/search) — search the web, news, scholars, AI, and social media.
- [Web Fetch](https://docs.crustdata.com/web-docs/fetch) — fetch the HTML content of public URLs.
- [Web API Examples](https://docs.crustdata.com/web-docs/examples) — ready-to-copy patterns for common use cases.

Was this page helpful?

YesNo

[Person Examples\\
\\
Previous](https://docs.crustdata.com/person-docs/examples) [Web Search\\
\\
Next](https://docs.crustdata.com/web-docs/search)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.