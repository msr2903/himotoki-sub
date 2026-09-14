import { Anki } from "@src/learning-service/anki";
import { HimotokiLearningService } from "@src/learning-service/himotoki";
import { TLearningService } from "@src/models/types";

export const getLearningService = (learningService: TLearningService) => {
  if (learningService === "himotoki") {
    return new HimotokiLearningService();
  }
  if (learningService === "anki") {
    return new Anki();
  }
};
