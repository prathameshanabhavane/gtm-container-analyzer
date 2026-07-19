/**
 * GTM Authentication Hook
 * 
 * This is now a re-export of useGTMAuthContext for backward compatibility.
 * All auth state is managed by GTMAuthContext, ensuring:
 * - Single sign-in across the entire app
 * - Shared token between all components
 * - No repeated consent prompts
 */

import { useGTMAuthContext } from '../context/GTMAuthContext';

export const useGTMAuth = () => {
  return useGTMAuthContext();
};

export default useGTMAuth;
