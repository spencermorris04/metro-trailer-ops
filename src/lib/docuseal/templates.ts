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
  category: DocusealTemplateCategory;
  folderName: string;
  location: string;
  submitterRole: string;
  active: boolean;
  editorUrl: string;
  fields: DocusealFieldDefinition[];
};

export type DocusealTemplateCategory =
  | "lease"
  | "payment_authorization"
  | "credit_application"
  | "other";

export type DocusealTemplateAlias = Omit<
  DocusealTemplateDefinition,
  "editorUrl" | "fields"
>;

export const docusealTemplateAliases = [
  {
    key: "road-trailer-nsh",
    docusealTemplateId: 1,
    name: "Road Trailer Contract.NSH.rev2.03072025",
    category: "lease",
    folderName: "NSH",
    location: "NSH",
    submitterRole: "First Party",
    active: true,
  },
  {
    key: "road-trailer-gsp",
    docusealTemplateId: 2,
    name: "Road Trailer Contract.GSP.rev3",
    category: "lease",
    folderName: "GSP",
    location: "GSP",
    submitterRole: "First Party",
    active: true,
  },
  {
    key: "road-trailer-clt",
    docusealTemplateId: 3,
    name: "Road Trailer Contract.CLT.rev3",
    category: "lease",
    folderName: "CLT",
    location: "CLT",
    submitterRole: "First Party",
    active: true,
  },
  {
    key: "metro-service-credit-application",
    docusealTemplateId: 4,
    name: "Metro Service Credit Application",
    category: "credit_application",
    folderName: "CLE",
    location: "CLE",
    submitterRole: "First Party",
    active: true,
  },
  {
    key: "road-trailer-bhm",
    docusealTemplateId: 5,
    name: "Road Trailer Contract.BHM.rev5",
    category: "lease",
    folderName: "BHM",
    location: "BHM",
    submitterRole: "First Party",
    active: true,
  },
  {
    key: "office-trailer-lease-bhm",
    docusealTemplateId: 6,
    name: "METRO Trailer Office Trailer Lease Agreement.rev3",
    category: "lease",
    folderName: "BHM",
    location: "BHM",
    submitterRole: "First Party",
    active: true,
  },
  {
    key: "road-trailer-atl",
    docusealTemplateId: 7,
    name: "Road Trailer Contract.ATLrev5",
    category: "lease",
    folderName: "ATL",
    location: "ATL",
    submitterRole: "First Party",
    active: true,
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
