import Events from './Events'
import Form from './Form'
import { asyncSome, debounce, CancelablePromise } from './util'


export type FieldOpts = {
  node?: HTMLElement
  value?: string
  validate?: Array<Function>
  readOnly?: boolean
  validationDelay?: number
}

type State = {
  value: any
  error: any
  isChanged: boolean
  isValidating: boolean
  isValidated: boolean
  isValid: boolean
}

class Field {

  form: Form
  name: string
  opts: FieldOpts
  node: HTMLElement
  validators?: Array<Function>
  readOnly: boolean
  debounceValidate: Function
  state: State

  private _events: Events
  private _initialValue: any
  private _cancelablePromise: CancelablePromise

  static modifyValue(value) {
    return value === undefined || value === null ? '' : value
  }

  constructor(name: string, opts: FieldOpts = {}, form?: Form) {
    this.form                 = form
    this.name                 = name
    this.opts                 = opts
    this.node                 = opts.node
    this.readOnly             = opts.readOnly || false
    this.validators           = opts.validate || []
    this.debounceValidate     = this.opts.validationDelay ? debounce(this.validate, this.opts.validationDelay) : this.validate

    this.state = {
      value: Field.modifyValue(opts.value),
      error: null,
      isChanged: false,
      isValidating: false,
      isValidated: false,
      isValid: true,
    }

    this._events              = new Events()
    this._initialValue        = this.state.value
    this._cancelablePromise   = null

    // TODO how to detect this?
    // this.hasAsyncValidators = this.validators.some((validator) => (
    //   validator.constructor.name === 'AsyncFunction'
    // ))
  }

  setState(values: Partial<State>) {
    this.state = { ...this.state, ...values }
    this._events.dispatch('state change', this.state)
  }

  setRef(node) {
    this.node = node

    if (this.node) {
      this.node.addEventListener('blur', this.handleBlur)
    }
  }

  unsetRef() {
    if (this.node) {
      this.node.removeEventListener('blur', this.handleBlur)
    }

    this.node = null
  }

  handleBlur = () => {
    this._events.dispatch('blur')
  }

  set(value: any) {
    const modifiedValue = Field.modifyValue(value)

    if (modifiedValue !== this.state.value && !this.readOnly) {
      this.setState({
        value: modifiedValue,
        isChanged: true,
      })

      this._events.dispatch('set', this.state.value)
      this._events.dispatch('change', this.state.value) // @deprecated
    }
  }

  unset() {
    this.setState({
      value: this._initialValue,
      error: null,
      isChanged: false,
      isValidating: false,
      isValidated: false,
      isValid: true,
    })

    this._events.dispatch('unset')
  }

  validate = (): CancelablePromise => {
    if (!this.validators || !this.validators.length) {
      return
    }

    let error

    this._events.dispatch('start validate')

    const setError = (error: string) => {
      this.setState({
        error,
        isValid: !error,
        isValidating: false,
        isValidated: true,
      })

      this._events.dispatch('validate', this.state.error)
    }

    this.setState({
      isValidating: true,
    })

    if (this._cancelablePromise) {
      this._cancelablePromise.cancel()
    }

    this._cancelablePromise = new CancelablePromise(async (resolve) => {
      await asyncSome(this.validators, async (validator) => {
        error = await validator(this.state.value, this.form && this.form.fields) // error here is String error message
        return Boolean(error)
      })
      resolve()
    })

    return this._cancelablePromise.then(() => {
      setError(error)

      return error
    })
  }

  on(eventName: string, handler: Function) {
    this._events.subscribe(eventName, handler)
  }

  off(eventName: string, handler: Function) {
    this._events.unsubscribe(eventName, handler)
  }
}


export default Field