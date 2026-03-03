"use client";

import React, { useEffect, useState } from "react";
import { DatabaseIcon } from "lucide-react";

export function ActiveDatasetIndicator({ refreshTrigger = 0 }: Readonly<{ refreshTrigger?: number }>) {
    const [activeFile, setActiveFile] = useState<{ name: string } | null>(null);

    const fetchActiveFile = async () => {
        try {
            const response = await fetch("/api/files/active");
            if (response.ok) {
                const data = await response.json();
                setActiveFile(data);
            }
        } catch (error) {
            console.error("Failed to fetch active file", error);
        }
    };

    useEffect(() => {
        fetchActiveFile();
    }, [refreshTrigger]);

    if (!activeFile) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 rounded-full text-xs font-medium w-fit mx-auto mb-2 border border-dashed border-red-300 dark:border-red-800/50">
                <DatabaseIcon size={14} />
                <span>No active dataset. Please upload a JSON file.</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 rounded-full text-xs font-medium w-fit mx-auto mb-2">
            <DatabaseIcon size={14} />
            <span>Active Dataset: {activeFile.name}</span>
        </div>
    );
}