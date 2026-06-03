const { createApp } = Vue;

createApp({
  data() {
    return {
      navItems: [
        { text: "Pricing", href: "#pricing" },
        { text: "Features", href: "#features" },
        { text: "FAQ", href: "#faq" },
      ],
      heroImages: [
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&w=900&q=80",
        "/images/programmar.jpg",
        "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&w=600&q=80",
      ],
      plans: [
        {
          name: "Basic",
          price: "Free",
          image:
            "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&w=600&q=80",
          features: [
            "Resume review with AI feedback",
            "Role-tailored interview questions",
          ],
          disabled: true,
        },
        {
          name: "Pro",
          price: "Rs. 100 / month",
          image:
            "https://images.unsplash.com/photo-1566112718365-4c8ccbedc3d9?auto=format&w=600&q=80",
          features: [
            "Everything in Basic",
            "Answer submission and scoring",
            "Priority processing",
          ],
          disabled: false,
        },
        {
          name: "Ultra Pro+",
          price: "Rs. 500 / month",
          image:
            "https://images.unsplash.com/photo-1684394213233-792d1ec08035?auto=format&w=600&q=80",
          features: [
            "Everything in Pro",
            "Saved evaluations and history",
            "Team dashboards (coming soon)",
          ],
          disabled: false,
        },
      ],
    };
  },
  methods: {
    goToResume() {
      window.location.href = "/resume";
    },
  },
}).mount("#app");
