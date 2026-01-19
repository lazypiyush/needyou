export default function StructuredData() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'NeedYou',
        url: 'https://need-you.xyz',
        description: 'Find local services and micro-jobs in India. Connect with skilled workers for household tasks, repairs, and services.',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://need-you.xyz/search?q={search_term_string}'
            },
            'query-input': 'required name=search_term_string'
        },
        publisher: {
            '@type': 'Organization',
            name: 'NeedYou',
            logo: {
                '@type': 'ImageObject',
                url: 'https://need-you.xyz/logo.jpg'
            }
        }
    }

    const organizationData = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'NeedYou',
        url: 'https://need-you.xyz',
        logo: 'https://need-you.xyz/logo.jpg',
        description: 'Trusted micro-job and local services platform in India',
        address: {
            '@type': 'PostalAddress',
            addressCountry: 'IN'
        },
        sameAs: [
            // Add your social media URLs here
            // 'https://twitter.com/needyou',
            // 'https://facebook.com/needyou',
            // 'https://instagram.com/needyou'
        ]
    }

    const serviceData = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Local Services Marketplace',
        provider: {
            '@type': 'Organization',
            name: 'NeedYou'
        },
        areaServed: {
            '@type': 'Country',
            name: 'India'
        },
        hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Services',
            itemListElement: [
                {
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: 'Household Tasks'
                    }
                },
                {
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: 'Repairs and Maintenance'
                    }
                },
                {
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: 'Professional Services'
                    }
                }
            ]
        }
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceData) }}
            />
        </>
    )
}
