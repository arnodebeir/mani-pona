import * as openpgp from 'openpgp'
import fs from 'fs'

const unpack = async (key) => {
  const { err, keys: [parsedkey] } = await openpgp.key.readArmored(key)
  if (err) {
    throw err[0]
  }
  return parsedkey
}

const Signer = (key) => {
  let pk
  return {
    sign: async (text) => {
      pk = pk === undefined ? await unpack(key) : pk
      const { signature: detachedSignature } = await openpgp.sign({
        message: openpgp.cleartext.fromText(text),
        privateKeys: [pk],
        detached: true
      })
      return detachedSignature
    }
  }
}

/**
 * Simplified, asynchronous signature verification that throws Errors when things don't line up. To use:
 *
 * `const fingerprint = await Verifier(key).verify(text, signature)`
 * The Verifier can be reused.
 *
 * @param {string} key - An armored OpenPGP (public) key
 */
const Verifier = (key) => {
  let pk
  return {
    /**
     * @param {string} text - The text that was signed
     * @param {string} signature - The armored and detached OpenPGP signature
     * @returns true is the signature matches
     * @throws An error if the input (key or signature) is not in a valid format or if the signature doesn't match.
     */
    verify: async (text, signature) => {
      pk = pk === undefined ? await unpack(key) : pk
      const { signatures } = await openpgp.verify({
        message: openpgp.cleartext.fromText(text),
        signature: await openpgp.signature.readArmored(signature),
        publicKeys: [pk]
      })
      if (signatures[0].valid) {
        return true
      } else {
        throw new Error('The proof signature didn\'t match either this key or the challenge.')
      }
    },
    fingerprint: async () => {
      pk = pk === undefined ? await unpack(key) : pk
      return pk.getFingerprint()
    }
  }
}

const KeyWrapper = (key) => {
  return {
    publicKeyArmored: key.publicKeyArmored,
    publicKey: Verifier(key.publicKeyArmored),
    privateKey: Signer(key.privateKeyArmored),
    write: async (file) => fs.writeFile(file, JSON.stringify(key))
  }
}

const KeyLoader = (file) => {
  const key = JSON.parse(fs.readFileSync(file))
  return KeyWrapper(key)
}

const KeyGenerator = (userId = {}) => {
  return {
    generate: async () => {
      const key = await openpgp.generateKey({
        userIds: [userId],
        rsaBits: 4096
      })
      return KeyWrapper(key)
    }
  }
}

export { Verifier, Signer, KeyLoader, KeyGenerator }
