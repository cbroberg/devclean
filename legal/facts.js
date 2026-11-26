// ProductFacts for @broberg/legal (shape: ProductFacts). Only facts that are true today.
// devclean is a local CLI: it runs on the user's own Mac, sends nothing anywhere,
// and stores only its own config (~/.devclean.json) and scan cache (~/.devclean-cache.json).
export const FACTS = {
  id: "devclean",
  name: "devclean",
  hosting: [
    { what: "Programmet og dets filer", where: "Kun på brugerens egen computer" },
  ],
  dataCategories: [],
  subprocessors: [],
  conversationAnalysis: false,
  healthData: false,
};
