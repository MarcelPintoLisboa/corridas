import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';
import { t } from '@/i18n';

/** Abre a galeria e devolve a URI local da imagem escolhida */
export async function pickImage(aspect?: [number, number]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!aspect,
    aspect,
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0];
}

/** Envia uma imagem local para o bucket `media` e devolve a URL pública */
export async function uploadImage(localUri: string, folder: string, mimeType = 'image/jpeg') {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error(t('Faça login para enviar imagens'));

  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `${auth.user.id}/${folder}/${Date.now()}.${ext}`;
  const buffer = await new File(localUri).arrayBuffer();

  const { error } = await supabase.storage.from('st_media').upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('st_media').getPublicUrl(path).data.publicUrl;
}

/** Fluxo completo: escolher + enviar */
export async function pickAndUpload(folder: string, aspect?: [number, number]) {
  const asset = await pickImage(aspect);
  if (!asset) return null;
  return uploadImage(asset.uri, folder, asset.mimeType ?? 'image/jpeg');
}
