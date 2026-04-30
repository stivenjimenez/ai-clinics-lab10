"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import {
  newResearchSchema,
  type NewResearchInput,
  type NewResearchValues,
} from "@/lib/schema";
import { createResearch, ApiError } from "@/lib/api";
import styles from "./new-research-modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NewResearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewResearchInput, unknown, NewResearchValues>({
    resolver: zodResolver(newResearchSchema),
    defaultValues: {
      company_name: "",
      website: "",
      linkedin: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setSubmitError(null);
    }
  }, [open, reset]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = async (values: NewResearchValues) => {
    setSubmitError(null);
    try {
      const created = await createResearch({
        company_name: values.company_name,
        website: values.website,
        linkedin: values.linkedin,
        notes: values.notes,
      });
      onClose();
      router.push(`/research/${created.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `Error ${err.status} al crear el research`
          : err instanceof Error
            ? err.message
            : "Error desconocido";
      setSubmitError(message);
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-research-title"
      >
        <span className={styles.eyebrow}>PASO 1 · DATOS BÁSICOS</span>
        <h2 id="new-research-title" className={styles.title}>NUEVO RESEARCH</h2>
        <p className={styles.subtitle}>
          Solo el nombre es obligatorio. El agente investiga industria, dolores y
          oportunidades por su cuenta. Tomará 2–4 minutos.
        </p>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="company_name">
              EMPRESA <span className={styles.required}>*</span>
            </label>
            <input
              id="company_name"
              className={styles.input}
              placeholder="Ej. Mercado Sur"
              autoFocus
              {...register("company_name")}
            />
            {errors.company_name && (
              <span className={styles.error}>{errors.company_name.message}</span>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="website">SITIO WEB</label>
              <input
                id="website"
                className={styles.input}
                placeholder="ejemplo.com"
                {...register("website")}
              />
              {errors.website && (
                <span className={styles.error}>{errors.website.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="linkedin">LINKEDIN</label>
              <input
                id="linkedin"
                className={styles.input}
                placeholder="linkedin.com/company/…"
                {...register("linkedin")}
              />
              {errors.linkedin && (
                <span className={styles.error}>{errors.linkedin.message}</span>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notes">OBSERVACIONES</label>
            <textarea
              id="notes"
              className={styles.textarea}
              rows={4}
              placeholder="Lo que sepas de la empresa o lo que el ejecutivo te haya contado…"
              {...register("notes")}
            />
            <span className={styles.hint}>
              Este contexto guía la investigación. Mientras más específico, mejor.
            </span>
            {errors.notes && (
              <span className={styles.error}>{errors.notes.message}</span>
            )}
          </div>

          {submitError && <p className={styles.submitError}>{submitError}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creando…" : "Investigar empresa →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
