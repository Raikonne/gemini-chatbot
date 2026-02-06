import { Attachment } from "ai";
import {memo} from "react";

import { LoaderIcon, FileIcon } from "./icons";


export const PreviewAttachment = memo(({
                                           attachment,
                                           isUploading = false,
                                           onRemove,
                                       }: {
    attachment: Attachment;
    isUploading?: boolean;
    onRemove?: () => void;
}) => {
    const { name, contentType } = attachment;
    const displayName = name;
    const fileExt = displayName?.split(".").pop()?.toLowerCase() ?? "";
    let type = contentType;

    if (!type) {
        if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt)) {
            type = "image";
        } else if (fileExt === "pdf") {
            type = "application/pdf";
        } else if (fileExt === "json") {
            type = "application/json";
        }
    }

    const renderFilePreview = () => {
        if (!type) {
            return (
                <div className="text-zinc-500">
                    <FileIcon size={24} />
                </div>
            );
        }

        if (type.startsWith("image")) {
            return (
                <div className="flex flex-col items-center gap-1 text-blue-500">
                    <FileIcon size={24} />
                    <span className="text-[10px] font-bold">IMAGE</span>
                </div>
            );
        }

        if (type.includes("pdf")) {
            return (
                <div className="flex flex-col items-center gap-1 text-red-500">
                    <FileIcon size={24} />
                    <span className="text-[10px] font-bold">PDF</span>
                </div>
            );
        }

        if (type.includes("json")) {
            return (
                <div className="flex flex-col items-center gap-1 text-yellow-600">
                    <FileIcon size={24} />
                    <span className="text-[10px] font-bold">JSON</span>
                </div>
            );
        }

        return (
            <div className="text-zinc-500">
                <FileIcon size={24} />
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-2 max-w-16">
            <div
                className="h-20 w-16 bg-muted rounded-md relative flex flex-col items-center justify-center border cursor-default group"
                title={displayName}
            >
                {renderFilePreview()}

                {isUploading ? (
                    <div className="animate-spin absolute text-zinc-500 bg-muted/80 size-full flex items-center justify-center rounded-md">
                        <LoaderIcon />
                    </div>
                ) : (
                    onRemove && (
                        <div
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-background border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shadow-sm z-10"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-zinc-500 dark:text-zinc-400"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </div>
                    )
                )}
            </div>

            <div className="text-[10px] text-zinc-500 max-w-16 text-center break-words leading-tight line-clamp-3">
                {displayName}
            </div>
        </div>
    );
});

PreviewAttachment.displayName = "PreviewAttachment";