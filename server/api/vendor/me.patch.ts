import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { Vendor } from '../../models/Vendor'

const vendorProfileSchema = z
  .object({
    legalName: z.string().trim().min(1).max(200),
    displayName: z.string().trim().min(1).max(200),
    preferredPayoutMethod: z.enum(['paypal', 'venmo']).nullable(),
    payoutRecipientName: z.string().trim().max(200).optional().or(z.literal('')),
    paypalEmail: z.string().trim().email().max(320).optional().or(z.literal('')),
    venmoHandle: z.string().trim().max(100).optional().or(z.literal(''))
  })
  .superRefine((value, context) => {
    if (value.preferredPayoutMethod === 'paypal' && !value.paypalEmail?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PayPal email is required when PayPal is selected.',
        path: ['paypalEmail']
      })
    }

    if (value.preferredPayoutMethod === 'venmo' && !value.venmoHandle?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Venmo handle is required when Venmo is selected.',
        path: ['venmoHandle']
      })
    }

    if (value.preferredPayoutMethod && !value.payoutRecipientName?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recipient name is required when a payout method is selected.',
        path: ['payoutRecipientName']
      })
    }
  })

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = event.context.vendorId as string | undefined
  if (!vendorId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const parsed = vendorProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || 'Invalid profile update request'
    })
  }

  const vendor = await Vendor.findOneAndUpdate(
    {
      vendorId,
      status: 'active'
    },
    {
      $set: {
        legalName: parsed.data.legalName,
        displayName: parsed.data.displayName,
        preferredPayoutMethod: parsed.data.preferredPayoutMethod || undefined,
        payoutRecipientName: parsed.data.payoutRecipientName?.trim() || undefined,
        paypalEmail: parsed.data.paypalEmail?.trim().toLowerCase() || undefined,
        venmoHandle: parsed.data.venmoHandle?.trim() || undefined
      }
    },
    {
      returnDocument: 'after'
    }
  )

  if (!vendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vendor not found or inactive'
    })
  }

  return {
    vendor: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      phone: vendor.phone,
      preferredPayoutMethod: vendor.preferredPayoutMethod,
      payoutRecipientName: vendor.payoutRecipientName,
      paypalEmail: vendor.paypalEmail,
      venmoHandle: vendor.venmoHandle,
      status: vendor.status,
      approvedVendorId: vendor.approvedVendorId,
      lastLoginAt: vendor.lastLoginAt,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }
  }
})
