'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [sex, setSex] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      setUser(user)

      const { data, error } = await supabase
        .from('profiles')
        .select('weight_kg, height_cm, sex')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setWeight(data.weight_kg ?? '')
        setHeight(data.height_cm ?? '')
        setSex(data.sex ?? '')
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  const saveProfile = async () => {
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        weight_kg: weight === '' ? null : Number(weight),
        height_cm: height === '' ? null : Number(height),
        sex: sex === '' ? null : sex
      })
      .eq('id', user.id)

    if (error) {
      alert('Error guardando perfil: ' + error.message)
      return
    }

    alert('Perfil actualizado')
  }

  if (loading) return <p style={{ padding: 20 }}>Cargando...</p>

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Editar Perfil</h1>
        <p>No hay sesión iniciada.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Editar Perfil</h1>

      <div style={{ marginBottom: 10 }}>
        <label>Peso (kg)</label><br />
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Altura (cm)</label><br />
        <input
          type="number"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Sexo</label><br />
        <select value={sex} onChange={(e) => setSex(e.target.value)}>
          <option value="">Seleccionar</option>
          <option value="male">Hombre</option>
          <option value="female">Mujer</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <button onClick={saveProfile}>
        Guardar cambios
      </button>
    </div>
  )
}
