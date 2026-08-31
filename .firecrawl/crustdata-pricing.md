[Skip to main content](https://docs.crustdata.com/general/pricing#content-area)

You are viewing the documentation of the new API versions. We would love to hear from you. You can write to use at [support@crustdata.tech](mailto:support@crustdata.tech) for feedback and clarifications.

[Crustdata Docs home page![light logo](https://mintcdn.com/crustdata/D_7b8rIJs3leJu3M/logo/crustdata-logo-full-black.png?fit=max&auto=format&n=D_7b8rIJs3leJu3M&q=85&s=4be4304c52a005d9356a20bad429a965)![dark logo](https://mintcdn.com/crustdata/D_7b8rIJs3leJu3M/logo/crustdata-logo-full-white.png?fit=max&auto=format&n=D_7b8rIJs3leJu3M&q=85&s=d4ae3a6c89ef13ad4eb1a4b0b341d33c)](https://docs.crustdata.com/)

Search...

Ctrl KAsk AI

Search...

Navigation

Documentation

Pricing

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


close

On this page

- [Self-serve endpoint pricing](https://docs.crustdata.com/general/pricing#self-serve-endpoint-pricing)
- [Person endpoints](https://docs.crustdata.com/general/pricing#person-endpoints)
- [Company endpoints](https://docs.crustdata.com/general/pricing#company-endpoints)
- [Web endpoints](https://docs.crustdata.com/general/pricing#web-endpoints)
- [Person enrich pricing](https://docs.crustdata.com/general/pricing#person-enrich-pricing)
- [Common credit patterns](https://docs.crustdata.com/general/pricing#common-credit-patterns)
- [Person enrich request examples](https://docs.crustdata.com/general/pricing#person-enrich-request-examples)
- [Enterprise-only and plan-gated live endpoint pricing](https://docs.crustdata.com/general/pricing#enterprise-only-and-plan-gated-live-endpoint-pricing)
- [Live people and company data](https://docs.crustdata.com/general/pricing#live-people-and-company-data)
- [Shared live-search endpoints](https://docs.crustdata.com/general/pricing#shared-live-search-endpoints)
- [Free endpoints](https://docs.crustdata.com/general/pricing#free-endpoints)
- [Search vs enrich](https://docs.crustdata.com/general/pricing#search-vs-enrich)
- [Estimate usage before you launch](https://docs.crustdata.com/general/pricing#estimate-usage-before-you-launch)
- [Rate limit considerations](https://docs.crustdata.com/general/pricing#rate-limit-considerations)
- [Frequently asked questions](https://docs.crustdata.com/general/pricing#frequently-asked-questions)

Pricing can change by plan, entitlement, and endpoint version. Confirm the
current credit cost in your dashboard or with the Crustdata team before you
plan production usage.

Crustdata uses a credit model across its APIs. Use low-cost search endpoints
to narrow your list, then enrich only the records you want to inspect in
detail.

[**Search first** \\
\\
Use search endpoints for low-cost discovery, then enrich only the\\
records you want to keep.](https://docs.crustdata.com/person-docs/search)

[**Enrich selectively** \\
\\
Person enrich starts with a base profile and adds cost only when you ask\\
for higher-value data.](https://docs.crustdata.com/person-docs/enrichment)

[**Plan for live endpoint usage** \\
\\
Web live endpoints are available on self-serve plans. Company and Person\\
live endpoints remain plan-gated.](https://docs.crustdata.com/general/rate-limits)

Credits are currently valid for **6 months** from the purchase date.

## [​](https://docs.crustdata.com/general/pricing\#self-serve-endpoint-pricing)  Self-serve endpoint pricing

This page lists pricing for the endpoints currently documented in this docs
site. It does not include unpublished or not-yet-documented routes.

Use these tables to estimate common self-serve search, identify, and enrich
costs.

### [​](https://docs.crustdata.com/general/pricing\#person-endpoints)  Person endpoints

| Endpoint | Credit usage | Notes |
| --- | --- | --- |
| `/person/search` | **0.03** per result | Best for low-cost discovery and filtering. |
| `/person/search/autocomplete` | **Free** | Use for typeahead and filter builders. |
| `/person/enrich` | **1–7** per record | Starts with a base profile and scales with requested data. |

### [​](https://docs.crustdata.com/general/pricing\#company-endpoints)  Company endpoints

| Endpoint | Credit usage | Notes |
| --- | --- | --- |
| `/company/search` | **0.03** per result | Lightweight company discovery. |
| `/company/search/autocomplete` | **Free** | Useful for search UX and filter pickers. |
| `/company/enrich` | **2** per record | Flat-rate company enrichment. |
| `/company/identify` | **Free** | Resolve a company from a domain or other supported identifier. |

### [​](https://docs.crustdata.com/general/pricing\#web-endpoints)  Web endpoints

| Endpoint | Credit usage | Notes |
| --- | --- | --- |
| `/web/search/live` | **1** per query | Web search. Available on self-serve and enterprise plans. |
| `/web/enrich/live` | **1** per page | Web page fetch. Available on self-serve and enterprise plans. |

## [​](https://docs.crustdata.com/general/pricing\#person-enrich-pricing)  Person enrich pricing

Person enrich uses additive pricing. You pay for the base profile first, then
add credits only for the extra data you request.

| Data returned | Additional credits | What you get |
| --- | --- | --- |
| Base profile | **1** | Core person identity, role, location, experience, education, certifications, skills, and social handles |
| Personal email data | **+2** | Personal email details |
| Phone data | **+2** | Direct phone numbers |
| Business email data | **+1** | Verified business email details |
| Developer platform data | **+1** | Developer platform profile, repos, orgs, and activity |

The maximum current cost for a single enriched person record is **7 credits**.

For person enrich, send a JSON body with either
`professional_network_profile_urls` or `business_emails`, based on the
identifier you have.

### [​](https://docs.crustdata.com/general/pricing\#common-credit-patterns)  Common credit patterns

| Use case | Typical data requested | Credits |
| --- | --- | --- |
| Basic profile lookup | Base profile only | **1** |
| Sales outreach | Base profile + business email | **2** |
| Full outbound prospecting | Base profile + business email + phone | **4** |
| Recruiting with personal contact data | Base profile + personal email + phone | **5** |
| Maximum person enrich payload | Base profile + all add-ons | **7** |

## [​](https://docs.crustdata.com/general/pricing\#person-enrich-request-examples)  Person enrich request examples

Use these examples to enrich by LinkedIn URL, request specific fields, or
reverse-lookup a person from a business email.

Base profile request (1 credit)

Request specific fields

Reverse lookup by business email

```
curl --request POST \
    --url https://api.crustdata.com/person/enrich \
    --header 'authorization: Bearer YOUR_API_KEY' \
    --header 'content-type: application/json' \
    --header 'x-api-version: 2025-11-01' \
    --data '{
        "professional_network_profile_urls": [\
            "https://www.linkedin.com/in/abhilashchowdhary"\
        ]
    }'
```

For full request patterns and field selection behavior, see [Person\\
enrichment](https://docs.crustdata.com/person-docs/enrichment).

## [​](https://docs.crustdata.com/general/pricing\#enterprise-only-and-plan-gated-live-endpoint-pricing)  Enterprise-only and plan-gated live endpoint pricing

Company and Person live endpoints are plan-gated and can have custom quotas or
contract pricing.

Web Search and Web Fetch are available on self-serve plans. The live Company
and Person endpoints below still require the right plan or enterprise
access.

### [​](https://docs.crustdata.com/general/pricing\#live-people-and-company-data)  Live people and company data

| Endpoint | Credit usage | Notes |
| --- | --- | --- |
| `/person/professional_network/search/live` | **2** per profile | Fresh live people search. |
| `/person/professional_network/enrich/live` | **7** per profile | Fresh profile retrieval when cached enrich is not enough. |
| `/company/professional_network/search/live` | **2** per company | Fresh live company search. |

### [​](https://docs.crustdata.com/general/pricing\#shared-live-search-endpoints)  Shared live-search endpoints

| Endpoint | Credit usage | Notes |
| --- | --- | --- |
| `/professional_network/search/autocomplete` | **Free** | Shared live-search autocomplete when enabled for your account. |

## [​](https://docs.crustdata.com/general/pricing\#free-endpoints)  Free endpoints

These endpoints do not currently consume credits:

- `/person/search/autocomplete`
- `/company/search/autocomplete`
- `/company/identify`
- `/professional_network/search/autocomplete` (when enabled for your
enterprise plan)

## [​](https://docs.crustdata.com/general/pricing\#search-vs-enrich)  Search vs enrich

| If you need to… | Best endpoint type | Why |
| --- | --- | --- |
| Explore a large audience cheaply | Search | Search is priced for discovery and returns lightweight records. |
| Build full profiles or contact-ready records | Enrich | Enrich returns detailed person or company data. |
| Power typeahead or filter suggestions | Autocomplete | Autocomplete is free and designed for interactive search UIs. |

## [​](https://docs.crustdata.com/general/pricing\#estimate-usage-before-you-launch)  Estimate usage before you launch

1

[Navigate to header](https://docs.crustdata.com/general/pricing#)

List the endpoints your workflow will call

Separate self-serve, enterprise live, and utility requests. They are not
billed in the same way.

2

[Navigate to header](https://docs.crustdata.com/general/pricing#)

Estimate returned records per request

Search pricing depends on results returned, not only the number of
calls.

3

[Navigate to header](https://docs.crustdata.com/general/pricing#)

Account for optional data and live modes

Contact data, developer platform data, and enterprise live workflows can
raise per-record cost.

4

[Navigate to header](https://docs.crustdata.com/general/pricing#)

Multiply by daily volume

Model normal traffic first, then add weekly or monthly growth
assumptions.

5

[Navigate to header](https://docs.crustdata.com/general/pricing#)

Add a buffer for retries and spikes

Keep headroom for queue bursts, replay jobs, and production debugging.

## [​](https://docs.crustdata.com/general/pricing\#rate-limit-considerations)  Rate limit considerations

| Endpoint type | Typical rate limit |
| --- | --- |
| Person search | 15 requests per minute |
| Enterprise live endpoints | Custom by plan |

For throughput planning, see [Rate limits](https://docs.crustdata.com/general/rate-limits).

## [​](https://docs.crustdata.com/general/pricing\#frequently-asked-questions)  Frequently asked questions

How is search billed?

Search is billed per result returned. For example, 10 results at `0.03`
credits per result use `0.30` credits. A request that returns no results
uses no credits.

How do I keep person enrich costs under control?

Start with the base profile. Add business email, personal email, phone,
or developer platform data only when your workflow uses it.

What happens when I run out of credits?

Billable requests return an error until you purchase more credits or
your account is replenished under your plan.

Do unused credits expire?

Yes. Credits are valid for 6 months from the date of purchase.

Does live-search autocomplete cost credits?

No. `/professional_network/search/autocomplete` is currently free, but
it is still enterprise-only and plan-gated.

For plan, quota, or enterprise pricing questions, contact Crustdata support
through your account channel.

Was this page helpful?

YesNo

[Introduction\\
\\
Previous](https://docs.crustdata.com/general/introduction) [Rate limits\\
\\
Next](https://docs.crustdata.com/general/rate-limits)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.