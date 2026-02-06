import { motion } from "framer-motion";
import Image from "next/image";

export const Overview = () => {
    return (
        <motion.div
            key="overview"
            className="max-w-[500px] mt-20 mx-4 md:mx-0"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ delay: 0.5 }}
        >
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">

                <Image
                    src="/images/chatbot.jpg"
                    alt="Gemini Chatbot"
                    width={500}
                    height={300}
                    className="w-full h-auto rounded-xl border border-zinc-100 dark:border-zinc-800"
                    priority
                />
            </div>
        </motion.div>
    );
};