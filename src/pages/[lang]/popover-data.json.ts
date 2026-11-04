import type { APIRoute } from 'astro';
import { getLanguageStaticPaths } from '../../utils/routes';
import { getPopoverData } from '../../utils/popover-data';

export const prerender = true;
export const getStaticPaths = getLanguageStaticPaths;

export const GET: APIRoute = ({ params }) => {
  return new Response(JSON.stringify(getPopoverData(params.lang ?? 'en')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
