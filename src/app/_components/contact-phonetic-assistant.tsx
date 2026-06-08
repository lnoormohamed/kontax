"use client";

import { useEffect } from "react";

import { toPhoneticValue } from "~/lib/phonetics";

type ContactPhoneticAssistantProps = {
  enabled: boolean;
  formId: string;
};

type ManagedPair = {
  sourceName: string;
  targetName: string;
};

const managedPairs: ManagedPair[] = [
  {
    sourceName: "firstName",
    targetName: "phoneticFirstName",
  },
  {
    sourceName: "lastName",
    targetName: "phoneticLastName",
  },
  {
    sourceName: "company",
    targetName: "phoneticCompany",
  },
];

const setAutoFilledValue = (target: HTMLInputElement, nextValue: string) => {
  target.value = nextValue;
  target.dataset.lastAutoFilledValue = nextValue;
  target.dataset.phoneticManual = "false";
};

export function ContactPhoneticAssistant({
  enabled,
  formId,
}: ContactPhoneticAssistantProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const cleanupHandlers: Array<() => void> = [];

    for (const pair of managedPairs) {
      const source = form.elements.namedItem(pair.sourceName);
      const target = form.elements.namedItem(pair.targetName);

      if (!(source instanceof HTMLInputElement) || !(target instanceof HTMLInputElement)) {
        continue;
      }

      const applySuggestedValue = () => {
        const currentValue = target.value.trim();
        const lastAutoFilledValue = target.dataset.lastAutoFilledValue ?? "";
        const isManual = target.dataset.phoneticManual === "true";

        if (currentValue && isManual && currentValue !== lastAutoFilledValue) {
          return;
        }

        const nextValue = toPhoneticValue(source.value) ?? "";

        if (!nextValue) {
          if (currentValue === lastAutoFilledValue) {
            setAutoFilledValue(target, "");
          }
          return;
        }

        if (!currentValue || currentValue === lastAutoFilledValue) {
          setAutoFilledValue(target, nextValue);
        }
      };

      const handleTargetInput = () => {
        const currentValue = target.value.trim();
        const lastAutoFilledValue = target.dataset.lastAutoFilledValue ?? "";

        if (!currentValue) {
          target.dataset.phoneticManual = "false";
          return;
        }

        target.dataset.phoneticManual =
          currentValue === lastAutoFilledValue ? "false" : "true";
      };

      source.addEventListener("input", applySuggestedValue);
      target.addEventListener("input", handleTargetInput);

      cleanupHandlers.push(() => {
        source.removeEventListener("input", applySuggestedValue);
        target.removeEventListener("input", handleTargetInput);
      });

      applySuggestedValue();
    }

    return () => {
      for (const cleanup of cleanupHandlers) {
        cleanup();
      }
    };
  }, [enabled, formId]);

  return null;
}
