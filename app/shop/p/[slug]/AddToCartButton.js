'use client'

import { useCart } from '../../../../components/CartContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddToCartButton({ product }) {
  const { addItem } = useCart()
  const router = useRouter()

  function handleAdd() {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    })
    toast.success(`${product.name} added to cart`, {
      style: { background: '#0d1b2a', color: '#fff' },
      iconTheme: { primary: '#4fc3f7', secondary: '#0d1b2a' },
    })
  }

  if (!product.inStock || product.price === 0) {
    return (
      <button disabled className="w-full py-4 bg-gray-200 text-gray-400 rounded-full font-bold tracking-widest uppercase text-sm cursor-not-allowed">
        {product.price === 0 ? 'Coming Soon' : 'Out of Stock'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleAdd}
        className="w-full py-4 bg-[#0d1b2a] text-white rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#1a2e45] transition-colors active:scale-95"
      >
        Add to Cart
      </button>
      <button
        onClick={() => { handleAdd(); router.push('/checkout') }}
        className="w-full py-4 bg-[#4fc3f7] text-[#0d1b2a] rounded-full font-bold tracking-widest uppercase text-sm hover:bg-[#2196f3] hover:text-white transition-colors active:scale-95"
      >
        Buy Now
      </button>
    </div>
  )
}
