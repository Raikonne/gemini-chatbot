"use client";

import { Attachment, ChatRequestOptions, CreateMessage, Message } from "ai";
import { motion } from "framer-motion";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  Dispatch,
  SetStateAction,
  ChangeEvent,
} from "react";
import { toast } from "sonner";

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
  messages,
  append,
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

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${(textareaRef.current.scrollHeight)}px`;
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; type: string }>>([]);

  const submitForm = useCallback(() => {
    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [attachments, handleSubmit, setAttachments, width]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/files/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const fileData = Array.isArray(data) ? data[0] : data;
        const { url, pathname, contentType } = fileData;

        return {
          url,
          name: pathname ?? file.name,
          contentType: contentType || file.type,
        };
      } else {
        const { error } = await response.json();
        toast.error(error);
      }
    } catch (error) {
      toast.error("Failed to upload file, please try again!");
    }
  };

  const handleFileChange = useCallback(
      async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);

        setUploadQueue(files.map((file) => ({ name: file.name, type: file.type })));

        try {
          const uploadPromises = files.map((file) => uploadFile(file));
          const uploadedAttachments = await Promise.all(uploadPromises);
          const successfullyUploadedAttachments = uploadedAttachments.filter(
              (attachment) => attachment !== undefined,
          );

          setAttachments((currentAttachments) => {
            const newFilenames = new Set(successfullyUploadedAttachments.map(a => a.name));

            const uniqueCurrentAttachments = currentAttachments.filter(
                attachment => !newFilenames.has(attachment.name ?? 'Attachment')
            );

            return [...uniqueCurrentAttachments, ...successfullyUploadedAttachments];
          });

        } catch (error) {
          console.error("Error uploading files!", error);
        } finally {
          setUploadQueue([]);
        }
      },
      [setAttachments],
  );

  const handleDeleteFile = async (attachment: Attachment) => {
    setAttachments((current) =>
        current.filter((a) => a.name !== attachment.name)
    );

    try {
      const response = await fetch(`/api/files/delete`, {
        method: "DELETE",
        body: JSON.stringify({
          url: attachment.url,
          path: attachment.name,
        }),
      });

      if (!response.ok) {
        setAttachments((current) => [...current, attachment]);
        console.error("Failed to delete file from storage");
        toast.error("Could not delete file from server");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      setAttachments((current) => [...current, attachment]);
      toast.error("Failed to delete file");
    }
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

      {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div className="flex flex-row gap-2 overflow-x-scroll p-2">
            {attachments.map((attachment, index) => (
                <PreviewAttachment
                    key={`${attachment.url}-${index}`}
                    attachment={attachment}
                    onRemove={() => handleDeleteFile(attachment)}
                />
            ))}

          {uploadQueue.map((file) => (
            <PreviewAttachment
              key={file.name}
              attachment={{
                url: "",
                name: file.name,
                contentType: file.type,
              }}
              isUploading={true}
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
          disabled={input.length === 0 || uploadQueue.length > 0}
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
