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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Authentication Required</DialogTitle>
                    <DialogDescription>
                        Please sign in or create an account to upload protected photos.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <p className="text-sm text-gray-500">
                        Join Cloaked to secure your images with advanced deepfake protection.
                    </p>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button asChild variant="outline" className="sm:w-full">
                        <Link href="/sign-in">Sign In</Link>
                    </Button>
                    <Button asChild className="sm:w-full">
                        <Link href="/sign-up">Sign Up</Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
