export type DocusealFieldSection =
  | "Customer and order"
  | "Equipment"
  | "Rates and terms"
  | "Execution"
  | "Special instructions"
  | "Inspection out"
  | "Inspection in"
  | "Tire readings"
  | "Receipt";

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

type DocusealFieldTuple = readonly [
  name: string,
  uuid: string,
  label: string,
  section: DocusealFieldSection,
  multiline?: boolean,
];

export const roadTrailerNshTemplate: DocusealTemplateDefinition = {
  key: "road-trailer-nsh",
  docusealTemplateId: 1,
  name: "Road Trailer Contract.NSH.rev2.03072025",
  location: "NSH",
  submitterRole: "First Party",
  fields: ([
    ["customer_phone", "d654e396-7578-407b-91ea-3d981c2a137e", "Phone No.", "Customer and order"],
    ["ordered_by", "aac1083d-f76e-4cce-b36a-a27639c73f3e", "Ordered By", "Customer and order"],
    ["customer_number", "f139e6d0-136b-4bca-9dd8-43177e45f74e", "Customer #", "Customer and order"],
    ["order_number", "084cbd30-b5d8-458f-ab41-3ccdde7b1224", "Order #", "Customer and order"],
    ["purchase_order_number", "e1d37689-fdfc-4787-a55b-35ab3df40b37", "PO #", "Customer and order"],
    ["agreement_date", "40052d4e-6d82-4329-a66c-45d95e11e00e", "Date", "Customer and order"],
    ["lessee_name", "7eb77161-3be8-4870-b047-655764119c5c", "Lessee name", "Customer and order"],
    ["lessee_location", "e382b4d0-8fe4-46b3-b4e6-5fea5f46f18e", "Lessee location", "Customer and order"],
    ["unit_number", "89592ae5-b845-4e75-b6cd-113715a27c01", "Unit #", "Equipment"],
    ["unit_type", "921c816c-6dba-45ad-9f42-0e38fe4f7a1e", "Type", "Equipment"],
    ["vin_number", "4641b404-4751-4ffb-a3d3-efc65253ca82", "VIN #", "Equipment"],
    ["tag_number", "018fd06a-6a84-4b66-84af-dff7bf380a6d", "Tag #", "Equipment"],
    ["rental_rate_per_day", "6b1c741a-276e-4af4-b512-dd48210cd973", "Rate per day", "Rates and terms"],
    ["rental_rate_per_week", "ff5c8291-0a2b-4193-9d1a-429a79479bf7", "Rate per week", "Rates and terms"],
    ["rental_rate_per_month", "f4ad312c-e161-4d96-905d-e78cb3912ca7", "Rate per month", "Rates and terms"],
    ["rental_rate_additional_terms", "caf00ef2-e052-44d4-9187-0a07b9ba901a", "Additional rate terms", "Rates and terms"],
    ["subject_to_amount", "e145de35-734c-4ca6-86b4-21cbbe0b9ca9", "Subject to amount", "Rates and terms"],
    ["subject_to_terms", "7a44a131-23b8-495c-906b-123edcca092b", "Subject to terms", "Rates and terms"],
    ["minimum_lease_period", "88954903-72b6-4fe9-a22b-e6fd42855d02", "Minimum lease period", "Rates and terms"],
    ["agreement_signed_day", "379ff443-117a-4259-bd0b-f79541757459", "Signed day", "Execution"],
    ["agreement_signed_month", "66aa773b-d9f2-48aa-8ee6-256bd8483fd9", "Signed month", "Execution"],
    ["agreement_signed_year", "ea681bef-e2c6-4c27-8b9b-d4e3239abc64", "Signed year", "Execution"],
    ["lessee_company_name", "612fba23-397a-49d5-8455-f9e926ca33cf", "Company name", "Execution"],
    ["lessee_authorized_agent", "992a31c3-bbe9-4498-9005-3f662b993153", "Authorized agent", "Execution"],
    ["lessee_authorized_agent_title", "2ce3bdd6-8e99-4f65-9598-c9ead3b0ed44", "Authorized agent title", "Execution"],
    ["metro_authorized_agent", "6b32d588-c23e-441d-940d-039010cf378f", "Metro authorized agent", "Execution"],
    ["metro_authorized_agent_title", "7205b793-be86-4d8f-a106-70f75319b1fc", "Metro authorized agent title", "Execution"],
    ["special_instructions_cpu", "31af6b90-7ed8-41c2-ad26-6c93aed0b6dd", "CPU", "Special instructions"],
    ["special_instructions_pickup", "1aac1cde-2af2-458b-a2de-23934d057a48", "Pick-up", "Special instructions"],
    ["special_instructions_line_1", "59d92dcf-0ddf-4ed6-b1a4-ea5212f31e03", "Special instructions line 1", "Special instructions", true],
    ["special_instructions_line_2", "40850487-37d0-4183-8561-ad3a7263d091", "Special instructions line 2", "Special instructions", true],
    ["special_instructions_line_3", "bbc4269a-07d1-4c7a-a35b-2067eb383f49", "Special instructions line 3", "Special instructions", true],
    ["inspection_out_brakes", "feee21d7-7c29-42b2-8027-9ba414292c6a", "Brakes", "Inspection out"],
    ["inspection_out_landing_gear", "ea87ef7e-8987-48bb-a614-8612f486fa5f", "Landing gear", "Inspection out"],
    ["inspection_out_fhwa", "4dfd2af4-5023-483e-a60c-4a4e7a902126", "FHWA", "Inspection out"],
    ["special_instructions_line_4", "75f2cd85-ac43-4f01-8c43-f5f6affa12e6", "Special instructions line 4", "Special instructions", true],
    ["inspection_out_lights", "4243dbb8-77b4-455c-bdae-49055b817b09", "Lights", "Inspection out"],
    ["inspection_out_undercarriage", "39925607-03bd-42fe-8e15-f6227c3d34c7", "Undercarriage", "Inspection out"],
    ["special_instructions_line_5", "1543d955-097b-4c5d-a0fa-cdc09e71c8bc", "Special instructions line 5", "Special instructions", true],
    ["inspection_out_doors", "9ad10de2-b1f5-4c9d-bb95-f2647cf94e30", "Doors", "Inspection out"],
    ["inspection_out_flaps", "771bc716-8b5d-46a5-bf49-aaada175e7b9", "Flaps", "Inspection out"],
    ["special_instructions_line_6", "ebacad3a-1436-4afa-98a8-7543a189f19d", "Special instructions line 6", "Special instructions", true],
    ["inspection_out_comments_line_1", "5da68e5e-0ce0-4fb0-89e1-c88813738988", "Comments line 1", "Inspection out", true],
    ["inspection_out_comments_line_2", "88dfa532-320d-413a-ab24-0f6e20fe828f", "Comments line 2", "Inspection out", true],
    ["inspection_out_comments_line_3", "de7cde20-3080-41be-966e-6187d41e2c3d", "Comments line 3", "Inspection out", true],
    ["inspection_in_notes_line_1", "ea3d12d6-557e-4f11-9a50-87903f0072a7", "Inspection in note line 1", "Inspection in", true],
    ["inspection_in_notes_line_2", "b1e84652-26aa-4236-8243-8b5407c4afc6", "Inspection in note line 2", "Inspection in", true],
    ["inspection_out_right_side_condition", "814e670d-3003-4805-aeb7-ae821933c5cb", "Right side condition", "Inspection out"],
    ["inspection_out_left_side_condition", "c22eca0e-617b-4349-97e9-21b97005d0e4", "Left side condition", "Inspection out"],
    ["inspection_out_front_condition", "860fbfd6-7857-4414-a05f-8fc7133d0c7c", "Front condition", "Inspection out"],
    ["inspection_in_notes_line_3", "8b70fd83-127a-4fd2-bc44-e907828a3f3d", "Inspection in note line 3", "Inspection in", true],
    ["inspection_in_notes_line_4", "2a4d3c1c-028a-4ce7-84b0-63fcf85fc07a", "Inspection in note line 4", "Inspection in", true],
    ["inspection_out_top_condition", "66e502c2-dc9f-4316-b2c0-dfb25088c035", "Top condition", "Inspection out"],
    ["inspection_out_floor_condition", "bbc311a7-7b05-4587-8005-85360e681f6d", "Floor condition", "Inspection out"],
    ["inspection_in_notes_line_5", "0ed729f3-b55d-44b9-a360-82ef71ee3c95", "Inspection in note line 5", "Inspection in", true],
    ["inspection_out_rear_condition", "8bb31aea-468c-4ed2-b822-65214118185a", "Rear condition", "Inspection out"],
    ["inspection_in_notes_line_6", "12730597-9f40-4a5e-93bb-6b3fef048822", "Inspection in note line 6", "Inspection in", true],
    ["inspection_in_notes_line_7", "e0a3e18e-35ed-45b5-a8e1-9b1b1654fd49", "Inspection in note line 7", "Inspection in", true],
    ["tire_lo_front_gauge_out", "796c6988-c301-48cc-94ff-8e52ca48853d", "L.O. front gauge out", "Tire readings"],
    ["tire_lo_front_gauge_in", "d97a0254-6d41-444e-9a46-2b71ed6c2554", "L.O. front gauge in", "Tire readings"],
    ["tire_ro_front_gauge_out", "88df554c-1307-4a12-9bef-1451177d1393", "R.O. front gauge out", "Tire readings"],
    ["tire_ro_front_gauge_in", "d5e15100-6609-41f7-a032-5bb1696ca8ff", "R.O. front gauge in", "Tire readings"],
    ["inspection_in_notes_line_8", "ad4381dd-da28-4a8c-aa45-65c6bb7c6719", "Inspection in note line 8", "Inspection in", true],
    ["tire_li_front_gauge_out", "6550180c-3bc1-4a75-b283-f89b1ceb41ad", "L.I. front gauge out", "Tire readings"],
    ["tire_li_front_gauge_in", "a1e1c4af-6e10-4ece-9b7d-590266913af0", "L.I. front gauge in", "Tire readings"],
    ["tire_ri_front_gauge_out", "e446ee9d-239f-433d-9f83-2336a592279c", "R.I. front gauge out", "Tire readings"],
    ["tire_ri_front_gauge_in", "671a94a3-9392-4dd1-864f-43d1a4cb7fa6", "R.I. front gauge in", "Tire readings"],
    ["inspection_in_notes_line_9", "e7681e44-34dd-4c30-bc7a-d09af1d7707f", "Inspection in note line 9", "Inspection in", true],
    ["tire_lo_rear_gauge_out", "305a7f41-2b73-44ea-b68b-f82a1cc825a5", "L.O. rear gauge out", "Tire readings"],
    ["tire_lo_rear_gauge_in", "d338a6fa-1568-4d24-94fc-4fab11966b33", "L.O. rear gauge in", "Tire readings"],
    ["tire_ro_rear_gauge_out", "381f262f-ed4c-467f-afaf-557e31d1cb5f", "R.O. rear gauge out", "Tire readings"],
    ["tire_ro_rear_gauge_in", "72b371f9-fec4-43ce-b2eb-20597a81cf46", "R.O. rear gauge in", "Tire readings"],
    ["inspection_in_month", "29aa6068-0191-4c77-aadf-eea7f8276c69", "Date in month", "Inspection in"],
    ["inspection_in_day", "eba653ae-cf6c-4191-9ec8-a70bcf43be63", "Date in day", "Inspection in"],
    ["inspection_in_year", "a4a968a9-f907-4cc2-b14d-e85924112a98", "Date in year", "Inspection in"],
    ["tire_li_rear_gauge_out", "773f738c-296b-433b-a4f6-dec9c8b1311e", "L.I. rear gauge out", "Tire readings"],
    ["tire_li_rear_gauge_in", "04be8011-ad80-4a81-9b00-4fee7a97d273", "L.I. rear gauge in", "Tire readings"],
    ["tire_ri_rear_gauge_out", "89353240-769e-438c-9324-e8822f457b2d", "R.I. rear gauge out", "Tire readings"],
    ["tire_ri_rear_gauge_in", "5c86e584-447b-4936-9ea3-e680b3710e3f", "R.I. rear gauge in", "Tire readings"],
    ["inspection_in_inspected_by", "e57ef6e7-ec62-42bd-8e8a-7e660b582eeb", "Inspected in by", "Inspection in"],
    ["received_by", "0e770feb-3f1a-48f7-8027-01a4fe366ad2", "Received by", "Receipt"],
    ["dun", "2bde997b-fe4e-4c26-9a96-28269c3a08b0", "DLN", "Receipt"],
    ["received_from", "7028553f-f2ed-4ae0-adf6-a44f0afa05f2", "Received from", "Receipt"],
    ["print_name", "22624fe8-5af0-4db4-ba99-4a0ff5ae240e", "Print name", "Receipt"],
  ] satisfies DocusealFieldTuple[]).map(([name, uuid, label, section, multiline]) => ({
    name,
    uuid,
    label,
    section,
    multiline: Boolean(multiline),
  })) satisfies DocusealFieldDefinition[],
};

export const docusealTemplates = [roadTrailerNshTemplate] satisfies DocusealTemplateDefinition[];

export function getDocusealTemplate(templateKey: string) {
  return docusealTemplates.find((template) => template.key === templateKey) ?? null;
}
