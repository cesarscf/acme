import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { env } from "@/env"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN
export const protocol = rootDomain.includes("localhost") ? "http" : "https"
