"use client";

import { Attachment, ChatRequestOptions, CreateMessage, Message } from "ai";
import React, {
  useRef,
  useEffect,
  useCallback,
  Dispatch,
  SetStateAction,
  ChangeEvent,
} from "react";
import { toast } from "sonner";

import {fileToBase64} from "@/db/util";

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

  const submitForm = useCallback(() => {
    handleSubmit(undefined, {
      experimental_attachments: attachments,
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

        try {
          const uploadPromises = files.map(async (file) => ({
            url: await fileToBase64(file),
            name: file.name,
            contentType: file.type,
          }));

          const newAttachments = await Promise.all(uploadPromises);

          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...newAttachments,
          ]);
        } catch (error) {
          console.error("Error reading files!", error);
          toast.error("Failed to read file");
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      },
      [setAttachments],
  );

  const handleDeleteFile = (attachment: Attachment) => {
    setAttachments((current) => current.filter((a) => a !== attachment));
  };

  return (
      <div className="relative w-full flex flex-col gap-4">
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