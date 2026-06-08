export type DavProp =
  | { name: "displayname"; value: string }
  | { name: "resourcetype"; types: Array<"collection" | "addressbook"> }
  | { name: "current-user-principal"; href: string }
  | { name: "addressbook-home-set"; href: string }
  | { name: "supported-address-data" }
  | { name: "getctag"; value: string }
  | { name: "getetag"; value: string };

export type DavResponseItem = {
  href: string;
  props: DavProp[];
  notFoundProps?: string[];
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const renderProp = (prop: DavProp) => {
  switch (prop.name) {
    case "displayname":
      return `<d:displayname>${escapeXml(prop.value)}</d:displayname>`;
    case "resourcetype":
      return `<d:resourcetype>${prop.types
        .map((type) => (type === "collection" ? "<d:collection/>" : "<card:addressbook/>"))
        .join("")}</d:resourcetype>`;
    case "current-user-principal":
      return `<d:current-user-principal><d:href>${escapeXml(prop.href)}</d:href></d:current-user-principal>`;
    case "addressbook-home-set":
      return `<card:addressbook-home-set><d:href>${escapeXml(prop.href)}</d:href></card:addressbook-home-set>`;
    case "supported-address-data":
      return '<card:supported-address-data><card:address-data-type content-type="text/vcard" version="3.0"/><card:address-data-type content-type="text/vcard" version="4.0"/></card:supported-address-data>';
    case "getctag":
      return `<cs:getctag>${escapeXml(prop.value)}</cs:getctag>`;
    case "getetag":
      return `<d:getetag>${escapeXml(prop.value)}</d:getetag>`;
  }
};

const renderNotFoundProp = (name: string) => `<d:${escapeXml(name)}/>`;

export const buildPropfindResponse = (responses: DavResponseItem[]) => {
  const body = responses
    .map((response) => {
      const okProps = response.props.map(renderProp).join("");
      const notFoundProps = response.notFoundProps?.map(renderNotFoundProp).join("") ?? "";
      const okPropstat = okProps
        ? `<d:propstat><d:prop>${okProps}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>`
        : "";
      const notFoundPropstat = notFoundProps
        ? `<d:propstat><d:prop>${notFoundProps}</d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>`
        : "";

      return `<d:response><d:href>${escapeXml(response.href)}</d:href>${okPropstat}${notFoundPropstat}</d:response>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:cs="http://calendarserver.org/ns/">${body}</d:multistatus>`;
};
