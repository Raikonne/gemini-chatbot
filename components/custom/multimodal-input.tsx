"use client";

import { createClient } from "@supabase/supabase-js";
import { Attachment, ChatRequestOptions, CreateMessage, Message } from "ai";
import React, {
    useRef,
    useEffect,
    useCallback,
    Dispatch,
    SetStateAction,
    ChangeEvent, useState,
} from "react";
import { toast } from "sonner";

import {ActiveDatasetIndicator} from "@/components/ui/active-dataset-indicator";
import { fileToBase64 } from "@/db/util";

import { ArrowUpIcon, PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import useWindowSize from "./use-window-size";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";


export function MultimodalInput({
                                  input,
                                  setInput,
                                  isLoading,
                                  stop,
                                  attachments,
                                  setAttachments,
                                  handleSubmit,
                                }: Readonly<{
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  append: (
      message: Message | CreateMessage,
      chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
      event?: {
        preventDefault?: () => void;
      },
      chatRequestOptions?: ChatRequestOptions,
  ) => void;
}>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

    const uploadFile = async (file: File) => {
        try {
            // 1. Get a signed upload URL from the server (no file body sent to Next.js)
            const signedRes = await fetch(
                `/api/files/signed-url?filename=${encodeURIComponent(file.name)}`
            );
            if (!signedRes.ok) {
                const { error } = await signedRes.json();
                toast.error(error || "Failed to get upload URL");
                return null;
            }
            const { signedUrl, token, path } = await signedRes.json();

            // 2. Upload directly to Supabase (bypasses Next.js body size limits)
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { error: uploadError } = await supabase.storage
                .from("chat-attachments")
                .uploadToSignedUrl(path, token, file, { upsert: true });

            if (uploadError) {
                console.error("Supabase upload error:", uploadError);
                toast.error("Upload failed");
                return null;
            }

            // 3. Save the file record to the database
            const metaRes = await fetch("/api/files/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, name: file.name, mimeType: file.type }),
            });

            if (!metaRes.ok) {
                const { error } = await metaRes.json();
                toast.error(error || "Failed to save file record");
                return null;
            }

            const fileRecord = await metaRes.json();
            return {
                url: fileRecord.url,
                name: file.name,
                contentType: file.type,
                extras: { id: fileRecord.id },
            };
        } catch (error) {
            toast.error("Failed to upload file, please try again!");
            console.error("Failed to upload file:", error);
            return null;
        }
    };

    const submitForm = useCallback(() => {
        const fileIds = attachments
            .map((a: any) => a.extras?.id)
            .filter((id) => id !== undefined);

        handleSubmit(undefined, {
            experimental_attachments: attachments,
            data: { files: fileIds },
        });

        setAttachments([]);

        if (width && width > 768) {
            textareaRef.current?.focus();
        }
    }, [attachments, handleSubmit, setAttachments, width]);

    const handleFileChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files || []);
            if (files.length === 0) return;

            const newAttachments: { url: any; name: any; contentType: any; extras?: { id: any; }; }[] = [];

            for (const file of files) {
                const isJson : boolean = file.name.endsWith(".json");

                if (isJson) {
                    const attachment = await uploadFile(file);
                    if (attachment) {
                        newAttachments.push(attachment);
                        setRefreshTrigger(prev => prev + 1);
                    }
                } else {
                    try {
                        const base64Url = await fileToBase64(file);
                        newAttachments.push({
                            url: base64Url,
                            name: file.name,
                            contentType: file.type
                        });
                    } catch (err) {
                        console.error(err);
                        toast.error("Failed to process file");
                    }
                }
            }

            setAttachments((currentAttachments) => [
                ...currentAttachments,
                ...newAttachments,
            ]);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        },
        [setAttachments]
    );

  const handleDeleteFile = (attachment: Attachment) => {
    setAttachments((current) => current.filter((a) => a !== attachment));
  };

    return (
        <div className="relative w-full flex flex-col gap-4">
            <ActiveDatasetIndicator refreshTrigger={refreshTrigger} />
            <input
                type="file"
                className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
                ref={fileInputRef}
                multiple
                onChange={handleFileChange}
                tabIndex={-1}
            />

            {attachments.length > 0 && (
                <div className="flex flex-row gap-2 overflow-x-scroll p-2">
                    {attachments.map((attachment, index) => (
                        <PreviewAttachment
                            key={`${attachment.name}-${index}`}
                            attachment={attachment}
                            onRemove={() => handleDeleteFile(attachment)}
                        />
                    ))}
                </div>
            )}

            <Textarea
                ref={textareaRef}
                placeholder="Send a message..."
                value={input}
                onChange={handleInput}
                className="min-h-[24px] overflow-hidden resize-none rounded-lg text-base bg-muted border-none"
                rows={3}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();

                        if (isLoading) {
                            toast.error("Please wait for the model to finish its response!");
                        } else {
                            submitForm();
                        }
                    }
                }}
            />

            {isLoading ? (
                <Button
                    className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 text-white"
                    onClick={(event) => {
                        event.preventDefault();
                        stop();
                    }}
                >
                    <StopIcon size={14} />
                </Button>
            ) : (
                <Button
                    className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 text-white"
                    onClick={(event) => {
                        event.preventDefault();
                        submitForm();
                    }}
                    disabled={input.length === 0 && attachments.length === 0}
                >
                    <ArrowUpIcon size={14} />
                </Button>
            )}

            <Button
                className="rounded-full p-1.5 h-fit absolute bottom-2 right-10 m-0.5 dark:border-zinc-700"
                onClick={(event) => {
                    event.preventDefault();
                    fileInputRef.current?.click();
                }}
                variant="outline"
                disabled={isLoading}
            >
                <PaperclipIcon size={14} />
            </Button>
        </div>
    );
}