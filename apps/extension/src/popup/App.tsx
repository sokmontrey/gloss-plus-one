import { cva } from "class-variance-authority";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

const card = cva(
    "rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
);

export function App() {
    return (
        <div className={cn("p-4 antialiased")}>
            <motion.div
                className={cn(card())}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-amber-500" aria-hidden />
                    <div>
                        <p className="font-semibold">Gloss Plus One</p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            Vite · React · CRXJS · Tailwind v4
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
