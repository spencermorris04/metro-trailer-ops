export type DocusealFieldSection =
  | "Customer and order"
  | "Equipment"
  | "Rates and terms"
  | "Execution"
  | "Special instructions"
  | "Inspection out"
  | "Inspection in"
  | "Tire readings"
  | "Receipt"
  | "Other";

export type DocusealFieldDefinition = {
  name: string;
  uuid: string;
  label: string;
  section: DocusealFieldSection;
  multiline?: boolean;
};

export type DocusealTemplateDefinition = {
  key: string;
  docusealTemplateId: number;
  name: string;
  location: string;
  submitterRole: string;
  fields: DocusealFieldDefinition[];
};

export type DocusealTemplateAlias = Omit<DocusealTemplateDefinition, "fields">;

export const docusealTemplateAliases = [
  {
    key: "road-trailer-nsh",
    docusealTemplateId: 1,
    name: "Road Trailer Contract.NSH.rev2.03072025",
    location: "NSH",
    submitterRole: "First Party",
  },
  {
    key: "road-trailer-gsp",
    docusealTemplateId: 2,
    name: "Road Trailer Contract.GSP.rev3",
    location: "GSP",
    submitterRole: "First Party",
  },
  {
    key: "road-trailer-clt",
    docusealTemplateId: 3,
    name: "Road Trailer Contract.CLT.rev3",
    location: "CLT",
    submitterRole: "First Party",
  },
  {
    key: "metro-service-credit-application",
    docusealTemplateId: 4,
    name: "Metro Service Credit Application",
    location: "CLE",
    submitterRole: "First Party",
  },
  {
    key: "road-trailer-bhm",
    docusealTemplateId: 5,
    name: "Road Trailer Contract.BHM.rev5",
    location: "BHM",
    submitterRole: "First Party",
  },
  {
    key: "office-trailer-lease-bhm",
    docusealTemplateId: 6,
    name: "METRO Trailer Office Trailer Lease Agreement.rev3",
    location: "BHM",
    submitterRole: "First Party",
  },
  {
    key: "road-trailer-atl",
    docusealTemplateId: 7,
    name: "Road Trailer Contract.ATLrev5",
    location: "ATL",
    submitterRole: "First Party",
  },
] satisfies DocusealTemplateAlias[];

export function getDocusealTemplateAlias(templateKey: string) {
  const normalizedKey = templateKey.trim().toLowerCase();

  return (
    docusealTemplateAliases.find((template) => template.key === normalizedKey) ??
    null
  );
}

export function getDocusealTemplateAliasById(docusealTemplateId: number) {
  return (
    docusealTemplateAliases.find(
      (template) => template.docusealTemplateId === docusealTemplateId,
    ) ?? null
  );
}
