const trackingEndpoint = "https://stcourier.com/track/doCheck";

export function StCourierTrackForm({ trackingNumber }: { trackingNumber: string }) {
  return <form action={trackingEndpoint} method="post" target="_blank" rel="noopener noreferrer">
    <input type="hidden" name="awb_no" value={trackingNumber} />
    <button className="btn btn-light" type="submit">Track with ST Courier</button>
  </form>;
}
