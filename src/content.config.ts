import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const migratedPageSchema = z.object({
  path: z.string(),
  sourceUrl: z.string(),
  title: z.string(),
  description: z.string().optional(),
  bodyClass: z.string().optional(),
  ogImage: z.string().optional(),
  htmlFile: z.string(),
  lastMigrated: z.string(),
  hidden: z.boolean().optional(),
});

export const collections = {
  pages: defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
    schema: migratedPageSchema,
  }),
  projects: defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
    schema: migratedPageSchema,
  }),
  writing: defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/content/writing' }),
    schema: migratedPageSchema,
  }),
};
