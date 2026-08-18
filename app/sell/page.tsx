'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function SellPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Clay Crafts & Home Decor')
  const [maxDiscountPoints, setMaxDiscountPoints] = useState('50')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    if (!imageFile || !title || !price) {
      setError('Image, title, aur price bharo.')
      return
    }
    setUploading(true)

    if (!user) {
      setError('Pehle sign in karo.')
      setUploading(false)
      router.push('/login')
      return
    }

    const filePath = `${user.id}/${Date.now()}-${imageFile.name}`
    const { error: uploadError } = await supabase.storage.from('products').upload(filePath, imageFile)
    if (uploadError) {
      setError('Image upload fail: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(filePath)

    const { error: rpcError } = await supabase.rpc('create_product', {
      p_title: title,
      p_description: description,
      p_price: Number(price),
      p_image_url: publicUrlData.publicUrl,
      p_category: category,
      p_max_discount_points: Number(maxDiscountPoints) || 0,
    })

    setUploading(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    router.push('/bazaar')
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-xl font-bold text-amber-900">List a Product</h1>
      <p className="text-xs text-stone-500 mt-1">Your handmade product goes live in the Local Bazaar instantly.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-stone-800">Product photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-stone-800">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hand-Painted Clay Diya Set"
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-stone-800">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of your product"
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-semibold text-stone-800">Price (₹)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="149"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-semibold text-stone-800">Max points discount</label>
            <input
              type="number"
              value={maxDiscountPoints}
              onChange={(e) => setMaxDiscountPoints(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-stone-800">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
          >
            <option>Clay Crafts & Home Decor</option>
            <option>Handwoven Baskets</option>
            <option>Painting & Art</option>
            <option>Jute Bags</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full bg-stone-900 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {uploading ? 'Listing…' : 'List Product'}
        </button>
      </div>
    </div>
  )
}
