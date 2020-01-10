import { useEffect } from 'react'

import Field from './Field'
import useForceUpdate from './useForceUpdate'


const useFieldState = (field: Field) => {
  const forceUpdate = useForceUpdate()

  useEffect(() => {
    field.on('state change', forceUpdate)

    return () => {
      field.off('state change', forceUpdate)
    }
  }, [])

  return field.state
}


export default useFieldState
