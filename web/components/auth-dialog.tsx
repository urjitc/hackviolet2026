"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface AuthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-[var(--vintage-cream)] border-[var(--vintage-brown)]/20">
                <DialogHeader className="text-center items-center">
                    <DialogTitle className="font-handwriting text-3xl text-[var(--vintage-brown)]">Authentication Required</DialogTitle>
                    <DialogDescription className="text-[var(--vintage-brown)]/70 text-base">
                        Please sign in or create an account to upload protected photos.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 text-center">
                    <p className="text-sm text-[var(--vintage-brown)]/60 font-medium">
                        Join Cloaked to secure your images with advanced deepfake protection.
                    </p>
                </div>
                <DialogFooter className="flex flex-col gap-3 sm:flex-col sm:justify-center w-full">
                    <Button asChild className="w-full btn-vintage font-handwriting text-lg h-12">
                        <Link href="/sign-in">Sign In</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full border-[var(--vintage-brown)]/30 text-[var(--vintage-brown)] hover:bg-[var(--vintage-brown)]/5 font-handwriting text-lg h-12">
                        <Link href="/sign-up">Sign Up</Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
