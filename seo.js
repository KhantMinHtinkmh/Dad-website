(function () {
    function upsertMetaByName(name, content) {
        let el = document.querySelector('meta[name="' + name + '"]');
        if (!el) {
            el = document.createElement("meta");
            el.setAttribute("name", name);
            document.head.appendChild(el);
        }
        el.setAttribute("content", content || "");
    }

    function upsertMetaByProperty(property, content) {
        let el = document.querySelector('meta[property="' + property + '"]');
        if (!el) {
            el = document.createElement("meta");
            el.setAttribute("property", property);
            document.head.appendChild(el);
        }
        el.setAttribute("content", content || "");
    }

    function upsertLink(rel, href) {
        let el = document.querySelector('link[rel="' + rel + '"]');
        if (!el) {
            el = document.createElement("link");
            el.setAttribute("rel", rel);
            document.head.appendChild(el);
        }
        el.setAttribute("href", href || "");
    }

    function setBookSeo(config) {
        const siteName = config.siteName || "Phat Hmat Tway";
        const title = config.title ? config.title + " | " + siteName : siteName;
        const description = config.description || "Book summary and key takeaways.";
        const image = config.image || "";
        const canonicalUrl = config.url || window.location.href;

        document.title = title;
        upsertMetaByName("description", description);
        upsertMetaByProperty("og:type", "article");
        upsertMetaByProperty("og:site_name", siteName);
        upsertMetaByProperty("og:title", title);
        upsertMetaByProperty("og:description", description);
        upsertMetaByProperty("og:image", image);
        upsertMetaByProperty("og:url", canonicalUrl);
        upsertMetaByName("twitter:card", "summary_large_image");
        upsertMetaByName("twitter:title", title);
        upsertMetaByName("twitter:description", description);
        upsertMetaByName("twitter:image", image);
        upsertLink("canonical", canonicalUrl);
    }

    function setBookSchema(config) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "Book",
            name: config.name || "",
            author: {
                "@type": "Person",
                name: config.author || ""
            },
            genre: config.genre || "Nonfiction",
            description: config.description || "",
            image: config.image || "",
            aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: String(config.ratingValue || "4.8"),
                ratingCount: String(config.ratingCount || "120")
            }
        };

        if (config.url) {
            schema.url = config.url;
            schema.mainEntityOfPage = config.url;
        }

        let schemaScript = document.getElementById("bookSchemaJsonLd");
        if (!schemaScript) {
            schemaScript = document.createElement("script");
            schemaScript.type = "application/ld+json";
            schemaScript.id = "bookSchemaJsonLd";
            document.head.appendChild(schemaScript);
        }
        schemaScript.textContent = JSON.stringify(schema);
    }

    window.SeoManager = {
        setBookSeo: setBookSeo,
        setBookSchema: setBookSchema
    };
})();
