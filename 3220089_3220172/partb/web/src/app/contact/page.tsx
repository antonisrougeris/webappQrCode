export const metadata = {
  title: "Contact | Skanare",
  description: "Contact Skanare for questions about QR clothing and accessories.",
};

export default function ContactPage() {
  return (
    <>
      <main className="contact-page">
        <section className="contact-wrapper">
          <h1>Contact us</h1>

          <p className="contact-subtitle">Do you have any inquiries?</p>

          <p className="contact-email">
            Feel free to send us an email:{" "}
            <a href="mailto:info@skanare.com">info@skanare.com</a>
          </p>

          <form className="contact-form">
            <div className="form-grid">
              <input type="text" name="name" placeholder="Name" required />
              <input type="email" name="email" placeholder="E-mail" required />
            </div>

            <textarea
              name="message"
              placeholder="Message"
              rows={6}
              required
            />

            <button type="submit" className="btn-primary">
              Send message
            </button>

            <p className="form-status">
              For now, please email us directly at info@skanare.com.
            </p>
          </form>
        </section>
      </main>

      <section id="how" className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">How it works</h2>
          </div>

          <div className="grid grid-3 how-it-works">
            <article className="card step">
              <h3>Choose product</h3>
              <p className="meta">Pick a t-shirt, hoodie or accessory.</p>
            </article>

            <article className="card step">
              <h3>Add your QR link</h3>
              <p className="meta">
                Enter the URL, social profile or text you want to open.
              </p>
            </article>

            <article className="card step">
              <h3>Change it anytime</h3>
              <p className="meta">
                After purchase, edit the QR destination without replacing the shirt.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}